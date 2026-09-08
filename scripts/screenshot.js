// Captures the Chrome Web Store screenshot of the options page (1280x800) using
// Chrome for Testing, with a few sample courses filled in.
//
//   npm run screenshot
//
// Reuses the end-to-end test's browser setup, so the same requirements apply:
// Node 22+, and Chrome for Testing is downloaded on first use unless CHROME_PATH
// is set.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Browser,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
  resolveBuildId,
} from '@puppeteer/browsers';
import { Cdp, waitFor } from '../test/e2e/cdp.js';

const extensionDir = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const output = join(extensionDir, 'docs', 'store', 'screenshot-options-1280x800.png');
const profileDir = mkdtempSync(join(tmpdir(), 'canvas-download-sorter-shot-'));

const sampleCourses = {
  171357: { name: 'ECON 1011A: Intermediate Microeconomics: Advanced', folder: 'EC1011a' },
  172010: { name: 'MATH 21A: Multivariable Calculus', folder: 'Math 21a' },
  173544: { name: 'GOV 20: Foundations of Comparative Politics', folder: 'Gov 20' },
  174120: { name: 'EXPOS 20: Expository Writing', folder: '' },
};

function unpackedExtensionId(dir) {
  const hex = createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

async function chromeBinary() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cacheDir = join(homedir(), '.cache', 'puppeteer');
  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
  const options = { browser: Browser.CHROME, buildId, cacheDir, platform };
  if (!existsSync(computeExecutablePath(options))) {
    console.log(`downloading Chrome for Testing ${buildId} to ${cacheDir} …`);
  }
  return (await install(options)).executablePath;
}

const chrome = spawn(
  await chromeBinary(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--password-store=basic',
    '--use-mock-keychain',
    '--hide-scrollbars',
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionDir}`,
    '--remote-debugging-port=0',
    '--window-size=1280,800',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

const port = await new Promise((resolve, reject) => {
  let stderr = '';
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk;
    const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);
    if (match) resolve(Number(match[1]));
  });
  chrome.on('exit', (code) => reject(new Error(`Chrome exited with code ${code}\n${stderr}`)));
});

try {
  const targets = async () => (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const extensionId = unpackedExtensionId(extensionDir);
  const page = await waitFor('the initial tab', async () =>
    (await targets()).find((t) => t.type === 'page'),
  );
  const worker = await waitFor('the extension service worker', async () =>
    (await targets()).find(
      (t) =>
        t.type === 'service_worker' && t.url === `chrome-extension://${extensionId}/background.js`,
    ),
  );

  const sw = new Cdp(worker.webSocketDebuggerUrl);
  const tab = new Cdp(page.webSocketDebuggerUrl);
  await sw.evaluate(`chrome.storage.sync.set(${JSON.stringify({ courses: sampleCourses })})`);

  await tab.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await tab.send('Page.navigate', { url: `chrome-extension://${extensionId}/options.html` });
  await waitFor('the options page to render', () =>
    tab.evaluate(`document.querySelectorAll('#courses tbody tr').length === 4`).catch(() => false),
  );

  const { data } = await tab.send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(join(extensionDir, 'docs', 'store'), { recursive: true });
  writeFileSync(output, Buffer.from(data, 'base64'));
  console.log(`wrote ${output}`);

  sw.close();
  tab.close();
} finally {
  chrome.kill('SIGTERM');
  await new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) resolve();
    else chrome.once('exit', resolve);
  });
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
}
