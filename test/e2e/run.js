// End-to-end test: loads the extension into Chrome for Testing, points it at a
// fake Canvas served from this process, and checks where downloads end up.
//
//   npm run test:e2e
//
// Chrome for Testing is downloaded into ~/.cache/puppeteer on first run (about
// 150 MB) unless CHROME_PATH names a Chrome binary that honours --load-extension.
// Needs Node 22+ and openssl on the PATH.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
import { Cdp, waitFor } from './cdp.js';
import { COURSE_ID, COURSE_NAME, startFakeCanvas } from './fake-canvas.js';

const extensionDir = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));
const workDir = mkdtempSync(join(tmpdir(), 'canvas-download-sorter-e2e-'));
const downloadDir = join(workDir, 'downloads');
const profileDir = join(workDir, 'profile');

let failures = 0;
function check(name, passed, detail = '') {
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!passed) failures += 1;
}

// Chrome derives an unpacked extension's id from a hash of its directory path.
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

function selfSignedCertificate() {
  const cert = join(workDir, 'cert.pem');
  const key = join(workDir, 'key.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      key,
      '-out',
      cert,
      '-subj',
      '/CN=canvas.harvard.edu',
      '-addext',
      'subjectAltName=DNS:canvas.harvard.edu,DNS:localhost',
    ],
    { stdio: 'ignore' },
  );
  return { cert: readFileSync(cert), key: readFileSync(key) };
}

function launchChrome(binary) {
  mkdirSync(downloadDir, { recursive: true });
  mkdirSync(join(profileDir, 'Default'), { recursive: true });
  writeFileSync(
    join(profileDir, 'Default', 'Preferences'),
    JSON.stringify({
      download: {
        default_directory: downloadDir,
        prompt_for_download: false,
        directory_upgrade: true,
      },
    }),
  );

  const chrome = spawn(
    binary,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      // Without these Chrome can block on the OS keyring or on a small /dev/shm in CI.
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-dev-shm-usage',
      // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      `--user-data-dir=${profileDir}`,
      `--load-extension=${extensionDir}`,
      '--remote-debugging-port=0',
      '--host-resolver-rules=MAP canvas.harvard.edu 127.0.0.1, MAP localhost 127.0.0.1',
      '--ignore-certificate-errors',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let stderr = '';
  const devtoolsPort = new Promise((resolve, reject) => {
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);
      if (match) resolve(Number(match[1]));
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited with code ${code}\n${stderr}`)));
  });

  return { chrome, devtoolsPort, stderr: () => stderr };
}

function stop(child) {
  // A process killed by a signal has exitCode null and signalCode set.
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });
}

// A browser that never comes up must fail the run, not stall it.
const DEADLINE_MS = 5 * 60 * 1000;
let launched;
const deadline = setTimeout(() => {
  console.error(`\ngave up after ${DEADLINE_MS / 1000}s`);
  if (launched) {
    console.error(`Chrome's output so far:\n${launched.stderr()}`);
    launched.chrome.kill('SIGKILL');
  }
  process.exit(1);
}, DEADLINE_MS);

const server = await startFakeCanvas(selfSignedCertificate());
const canvas = `https://canvas.harvard.edu:${server.address().port}`;
const other = `https://localhost:${server.address().port}`;
launched = launchChrome(await chromeBinary());
const { chrome, devtoolsPort } = launched;

try {
  const port = await devtoolsPort;
  const targets = async () => (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const extensionId = unpackedExtensionId(extensionDir);
  const workerUrl = `chrome-extension://${extensionId}/background.js`;

  const page = await waitFor('the initial tab', async () =>
    (await targets().catch(() => [])).find((t) => t.type === 'page'),
  );
  const worker = await waitFor('the extension service worker', async () =>
    (await targets()).find((t) => t.type === 'service_worker' && t.url === workerUrl),
  ).catch(() => null);
  check('extension loads and its service worker starts', worker !== null, workerUrl);
  if (!worker) throw new Error('cannot continue without the extension');

  // Staying attached keeps the service worker alive, which makes it a handy
  // long-lived context for chrome.storage and chrome.action.
  const sw = new Cdp(worker.webSocketDebuggerUrl);
  const tab = new Cdp(page.webSocketDebuggerUrl);
  const pageTitle = () =>
    tab.evaluate(`document.readyState === 'complete' ? document.title : ''`).catch(() => '');
  const storedCourses = async () =>
    (await sw.evaluate(`chrome.storage.sync.get('courses')`)).courses ?? {};
  const downloaded = (...segments) =>
    waitFor(segments.join('/'), () => existsSync(join(downloadDir, ...segments))).then(
      () => true,
      () => false,
    );

  await tab.send('Page.navigate', { url: `chrome-extension://${extensionId}/options.html` });
  const title = await waitFor('the options page', pageTitle).catch(() => '');
  check('options page loads', title === 'Canvas Download Sorter', JSON.stringify(title));
  check(
    'options page shows the empty state when nothing is stored',
    await tab.evaluate(
      `!document.getElementById('empty').hidden && document.getElementById('courses').hidden`,
    ),
  );

  await sw.evaluate(
    `chrome.storage.sync.set({ courses: { '${COURSE_ID}': { name: 'Seeded name', folder: 'EC1011a' } } })`,
  );
  await tab.send('Page.reload');
  await waitFor('the options page to reload', pageTitle);
  const row = await waitFor('the course row', () =>
    tab.evaluate(`(() => {
      const row = document.querySelector('#courses tbody tr');
      return row && { name: row.querySelector('.course-name').textContent, folder: row.querySelector('.folder').value };
    })()`),
  ).catch(() => null);
  check(
    'options page lists the stored course and its folder',
    row?.name === 'Seeded name' && row?.folder === 'EC1011a',
    JSON.stringify(row),
  );

  await tab.send('Page.navigate', { url: `${canvas}/courses/${COURSE_ID}/files` });
  const recordedName = await waitFor('the content script to record the course name', async () => {
    const name = (await storedCourses())[COURSE_ID]?.name;
    return name === COURSE_NAME ? name : null;
  }).catch(() => storedCourses().then((courses) => courses[COURSE_ID]?.name));
  check(
    'visiting a course page records its name from the breadcrumb',
    recordedName === COURSE_NAME,
    JSON.stringify(recordedName),
  );
  check(
    'recording the name keeps the folder the user chose',
    (await storedCourses())[COURSE_ID]?.folder === 'EC1011a',
  );

  await tab.send('Page.navigate', {
    url: `${canvas}/courses/${COURSE_ID}/files/25672073/download?download_frd=1`,
  });
  check(
    'a course file download lands in the course folder, even via a CDN redirect',
    await downloaded('EC1011a', 'lecture4.pdf'),
  );

  await tab.send('Page.navigate', { url: `${canvas}/files/99/download?verifier=abc` });
  check(
    'a download URL without a course id uses the active course tab',
    await downloaded('EC1011a', 'pset3.pdf'),
  );

  await tab.send('Page.navigate', { url: `${other}/other.pdf` });
  check(
    'a download from another site stays in the download root',
    (await downloaded('other.pdf')) && !existsSync(join(downloadDir, 'EC1011a', 'other.pdf')),
  );

  await sw.evaluate(`chrome.storage.sync.set({ courses: {} })`);
  await tab.send('Page.navigate', { url: `${canvas}/courses/555/files/1/download` });
  check(
    'a download from an unnamed course stays in the download root',
    await downloaded('lecture4.pdf'),
  );
  const remembered = (await storedCourses())['555'];
  check(
    'the unnamed course is remembered so it can be named',
    remembered?.name === '' && remembered?.folder === '',
    JSON.stringify(remembered),
  );
  const badge = await waitFor(
    'the badge',
    async () => (await sw.evaluate(`chrome.action.getBadgeText({})`)) || null,
  ).catch(() => null);
  check('the badge counts unnamed courses', badge === '1', JSON.stringify(badge));

  sw.close();
  tab.close();
} catch (error) {
  console.error(error.message);
  failures += 1;
} finally {
  // Chrome keeps writing to its profile until it has fully exited.
  await stop(chrome);
  server.closeAllConnections();
  server.close();
  rmSync(workDir, { recursive: true, force: true, maxRetries: 5 });
  clearTimeout(deadline);
}

if (failures) {
  const chromeOutput = launched.stderr().split('\n').slice(-20).join('\n');
  console.error(`\n${failures} check(s) failed. Chrome's last output:\n${chromeOutput}`);
  process.exit(1);
}
console.log('\nall end-to-end checks passed');
