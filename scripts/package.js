// Builds the zip that goes on GitHub Releases and into the Chrome Web Store.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));

const { version } = readJson('manifest.json');
if (readJson('package.json').version !== version) {
  throw new Error('manifest.json and package.json disagree about the version');
}

const files = [
  'manifest.json',
  'background.js',
  'content.js',
  'sorter.js',
  'options.html',
  'options.css',
  'options.js',
  'icons',
];
const archive = `dist/canvas-download-sorter-${version}.zip`;

mkdirSync(`${root}dist`, { recursive: true });
rmSync(`${root}${archive}`, { force: true });
// -X leaves out macOS extended attributes, which would otherwise show up as junk files.
execFileSync('zip', ['-r', '-X', archive, ...files], { cwd: root, stdio: 'inherit' });
console.log(`\nwrote ${archive}`);
