import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
async function ready(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Orbital drive', exact: true })).toBeVisible();
  await expect(page.getByText('Opening demonstration model…')).toBeHidden();
  await expect(page.getByText('3D rendering is unavailable')).toBeHidden();
  await expect(page.locator('canvas')).toHaveCount(1);
}
test('opens a real workspace, supports mouse orbit and zoom, and resets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.waitForTimeout(1200);
  const canvas = page.locator('canvas');
  const sceneScreenshot = () =>
    canvas.screenshot({
      style: '.viewport > :not(:first-child) { visibility: hidden !important; }',
    });
  const before = await sceneScreenshot();
  expect(before.length).toBeGreaterThan(15000);
  await page.mouse.move(650, 400);
  await page.mouse.down();
  await page.mouse.move(780, 470, { steps: 10 });
  await page.mouse.up();
  const rotated = await sceneScreenshot();
  expect(Buffer.compare(before, rotated)).not.toBe(0);
  await page.mouse.wheel(0, -350);
  await page.waitForTimeout(150);
  expect(Buffer.compare(rotated, await sceneScreenshot())).not.toBe(0);
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await page.waitForTimeout(300);
  await canvas.screenshot({ path: 'test-results/reset-canvas.png' });
  await expect.poll(async () => Buffer.compare(before, await sceneScreenshot())).toBe(0);
  await page.getByRole('button', { name: 'Move tool', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move tool' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Rotate tool' }).click();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'docs/workspace.png' });
});
test('imports a GLB and inspects actual hierarchy metadata', async ({ page }) => {
  await ready(page);
  await page.getByTestId('model-input').setInputFiles(resolve('public/models/orbital-drive.glb'));
  await expect(page.getByRole('heading', { name: 'orbital-drive', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Find a component' }).fill('Front mounting flange');
  await page.getByRole('button', { name: 'Front mounting flange', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Front mounting flange', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Hide Front mounting flange' }).click();
  await expect(page.getByRole('button', { name: 'Show Front mounting flange' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle wireframe' }).click();
  await expect(page.getByRole('button', { name: 'Toggle wireframe' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hide Front mounting flange' })).toBeVisible();
});
test('recovers from invalid models and explains missing GLTF resources', async ({ page }) => {
  await ready(page);
  await page.getByTestId('model-input').setInputFiles({
    name: 'bad.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.getByRole('alert')).toContainText('not a valid');
  await expect(page.getByRole('heading', { name: 'Orbital drive', exact: true })).toBeVisible();
  await page.getByTestId('model-input').setInputFiles({
    name: 'missing.gltf',
    mimeType: 'model/gltf+json',
    buffer: Buffer.from(
      JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ uri: 'missing.bin', byteLength: 12 }],
      }),
    ),
  });
  await expect(page.getByRole('alert')).toContainText('Missing dependency');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.getByRole('alert')).toBeHidden();
});
test('does not request camera until asked, and handles denied permission', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    });
  });
  await ready(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('permission was denied');
  await expect(page.getByRole('button', { name: 'Enable gesture controls' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
test('explains a missing camera and keeps mouse controls available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('no device', 'NotFoundError')),
    });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Enable gesture controls' }).click();
  await expect(page.getByRole('alert')).toContainText('No camera found');
  await page.getByRole('button', { name: 'Move tool' }).click();
  await expect(page.getByRole('button', { name: 'Move tool' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('runs real MediaPipe on a synthetic test camera, collapses preview, and stops tracks', async ({
  page,
}) => {
  test.setTimeout(90000);
  const external: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('http') && !r.url().startsWith('http://127.0.0.1:4173'))
      external.push(r.url());
  });
  await ready(page);
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByText('LIVE · MIRRORED')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.tracking-performance')).toContainText(/\d+ detections\/s/);
  await expect
    .poll(async () => page.locator('.tracking-performance').innerText(), { timeout: 20000 })
    .not.toContain('0 detections/s');
  await page.evaluate(() => {
    const track = document.querySelector('video')!.srcObject as MediaStream;
    Object.defineProperty(window, 'testCameraTrack', {
      value: track.getVideoTracks()[0],
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(page.locator('.camera-video video')).toBeVisible();
  expect(
    await page.evaluate(() => {
      const stream = document.querySelector('video')!.srcObject as MediaStream;
      return (
        stream.getVideoTracks()[0] ===
        (window as unknown as { testCameraTrack: MediaStreamTrack }).testCameraTrack
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/workspace-live-focus.png' });
  await page.getByRole('button', { name: 'Exit focus mode' }).click();
  await page.getByRole('button', { name: 'Collapse camera preview' }).click();
  await expect(page.getByRole('button', { name: 'Disable gesture controls' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Enable gesture controls' })).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { testCameraTrack: MediaStreamTrack }).testCameraTrack.readyState,
    ),
  ).toBe('ended');
  expect(external).toEqual([]);
});
test('offers working settings, guide, explosion, and narrow-screen controls', async ({ page }) => {
  await ready(page);
  await page.getByLabel('Exploded view', { exact: true }).fill('0.7');
  await expect(page.getByText('70%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await page.getByLabel('Sensitivity', { exact: false }).fill('1.7');
  await expect(page.getByText('1.7×')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Orbital drive', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open scene explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'Model inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Close scene explorer' }).click();
  await page.screenshot({ path: 'docs/workspace-mobile.png' });
});

test('switches the entire workspace to light mode and remembers the choice', async ({ page }) => {
  await ready(page);
  const dark = await page.locator('canvas').screenshot();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.toolbar')).toHaveCSS('background-color', 'rgb(251, 253, 254)');
  expect(Buffer.compare(dark, await page.locator('canvas').screenshot())).not.toBe(0);
  await page.screenshot({ path: 'test-results/workspace-light.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('retracts panels, preserves the manipulated view, and restores keyboard access', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const canvas = page.locator('canvas');
  const sceneScreenshot = () =>
    canvas.screenshot({
      style: '.viewport > :not(:first-child) { visibility: hidden !important; }',
    });
  await page.mouse.move(660, 400);
  await page.mouse.down();
  await page.mouse.move(760, 470, { steps: 12 });
  await page.mouse.up();
  const before = await sceneScreenshot();
  const width = (await canvas.boundingBox())!.width;
  await page.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(page.getByRole('complementary', { name: 'Model inspector' })).toBeHidden();
  await expect(page.getByRole('region', { name: 'Camera controls' })).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(width);
  await page.screenshot({ path: 'test-results/workspace-focus.png' });
  await page.getByRole('button', { name: 'Exit focus mode' }).click();
  await expect(page.getByRole('complementary', { name: 'Model inspector' })).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBe(width);
  await expect.poll(async () => Buffer.compare(before, await sceneScreenshot())).toBe(0);
  await page.getByRole('button', { name: 'Retract scene explorer' }).click();
  await expect(page.getByRole('textbox', { name: 'Find a component' })).toBeHidden();
  await page.keyboard.press('/');
  await expect(page.getByRole('textbox', { name: 'Find a component' })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Enter focus mode' }).click();
  await expect(page.getByRole('region', { name: 'Camera controls' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/workspace-focus-mobile.png' });
});
