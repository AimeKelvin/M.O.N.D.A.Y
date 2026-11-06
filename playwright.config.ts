import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 45000,
  expect: { timeout: 10000 }, reporter: [['list'],['html',{open:'never'}]],
  use: { channel: process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? 'chrome' : undefined, baseURL:'http://127.0.0.1:4173', trace:'retain-on-failure', screenshot:'only-on-failure', ...devices['Desktop Chrome'], viewport:{width:1440,height:1000}, launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']} },
  webServer: { command:'npm run preview -- --port 4173', url:'http://127.0.0.1:4173', reuseExistingServer:!process.env.CI, timeout:20000 },
});
