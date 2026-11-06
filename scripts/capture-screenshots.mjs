/** Capture real application states for the README. No camera access or mocked UI. */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'docs/screenshots');
const origin = 'http://127.0.0.1:4175';
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4175',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverLog = '';
let serverError;
server.stdout.on('data', (data) => {
  serverLog += data;
});
server.stderr.on('data', (data) => {
  serverLog += data;
});
server.on('error', (error) => {
  serverError = error;
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Preview server failed: ${serverLog}`);
    try {
      ready = (await fetch(origin)).ok;
    } catch {
      /* Wait for the preview listener. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Preview server did not start: ${serverLog}`);
  browser = await chromium.launch({
    channel:
      process.platform === 'darwin' &&
      existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? 'chrome'
        : undefined,
    args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1.5,
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'Orbital drive', exact: true })).toBeVisible();
  await expect(page.getByText('Opening demonstration model…')).toBeHidden();
  await expect(page.getByText('3D rendering is unavailable')).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  const capture = async (name) => {
    await page.mouse.move(0, 0);
    // Let shader compilation, resize observers and scene effects finish before capture.
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
    console.log(`Captured docs/screenshots/${name}.png`);
  };
  const zoomOut = async (steps) => {
    const viewport = page.viewportSize();
    await page.mouse.move(viewport.width * 0.5, viewport.height * 0.45);
    for (let step = 0; step < steps; step++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(70);
    }
  };
  await zoomOut(3);
  await capture('workspace-dark');

  await page.getByLabel('Exploded view', { exact: true }).fill('1');
  await zoomOut(4);
  await page.mouse.move(790, 430);
  await page.mouse.down();
  await page.mouse.move(735, 415, { steps: 16 });
  await page.mouse.up();
  await capture('exploded-assembly');

  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('textbox', { name: 'Find a component' }).fill('Front mounting flange');
  await page.getByRole('button', { name: 'Front mounting flange', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a component' }).fill('');
  await zoomOut(3);
  await capture('light-inspection');

  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(page.locator('#scene-sidebar')).toHaveCSS('width', '0px');
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(860, 470, { steps: 16 });
  await page.mouse.up();
  await zoomOut(3);
  await capture('focus-mode');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await zoomOut(2);
  await capture('mobile-focus');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  console.log('Saved five screenshots from the running production build.');
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await exited;
  }
}
