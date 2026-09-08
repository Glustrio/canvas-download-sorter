import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeChrome, flush } from './helpers/fake-chrome.js';

const named = {
  courses: { 171357: { name: 'ECON 1011A', folder: 'EC1011a' } },
  autoNaming: false,
};

let instance = 0;

// background.js registers its listeners when first evaluated, so each test installs
// a fresh fake `chrome` and evaluates a fresh copy of the module.
async function loadBackground(options) {
  const fake = createFakeChrome(options);
  globalThis.chrome = fake.chrome;
  await import(`../background.js?instance=${instance++}`);
  return fake;
}

function deferredSuggest() {
  let resolve;
  const called = new Promise((r) => {
    resolve = r;
  });
  return { suggest: mock.fn((...args) => resolve(args)), called };
}

function determineFilename(fake, item, suggest) {
  const [listener] = fake.listeners('downloads.onDeterminingFilename');
  return listener(item, suggest);
}

test('leaves downloads from other sites alone', async () => {
  const fake = await loadBackground({ storage: named });
  const { suggest } = deferredSuggest();

  const handledAsync = determineFilename(
    fake,
    { url: 'https://example.com/paper.pdf', referrer: '', filename: 'paper.pdf' },
    suggest,
  );
  await flush();

  assert.equal(handledAsync, false);
  assert.equal(suggest.mock.callCount(), 0);
});

test('files a Canvas download into the course folder', async () => {
  const fake = await loadBackground({ storage: named });
  const { suggest, called } = deferredSuggest();

  const handledAsync = determineFilename(
    fake,
    {
      url: 'https://canvas.harvard.edu/courses/171357/files/25672073/download?download_frd=1',
      referrer: 'https://canvas.harvard.edu/courses/171357/files',
      filename: 'lecture4.pdf',
    },
    suggest,
  );

  assert.equal(handledAsync, true);
  assert.deepEqual(await called, [
    { filename: 'EC1011a/lecture4.pdf', conflictAction: 'uniquify' },
  ]);
  assert.equal(suggest.mock.callCount(), 1);
});

test('uses the active Canvas tab to identify the course when the URL has none', async () => {
  const fake = await loadBackground({
    storage: named,
    tabs: [{ url: 'https://canvas.harvard.edu/courses/171357/modules' }],
  });
  const { suggest, called } = deferredSuggest();

  determineFilename(
    fake,
    {
      url: 'https://canvas.harvard.edu/files/25672073/download?verifier=abc',
      referrer: 'https://canvas.harvard.edu/',
      filename: 'lecture4.pdf',
    },
    suggest,
  );

  assert.deepEqual(await called, [
    { filename: 'EC1011a/lecture4.pdf', conflictAction: 'uniquify' },
  ]);
});

test('keeps the default filename for an unnamed course and remembers the course', async () => {
  const fake = await loadBackground({ storage: named });
  const { suggest, called } = deferredSuggest();

  determineFilename(
    fake,
    {
      url: 'https://canvas.harvard.edu/courses/999/files/1/download',
      referrer: '',
      filename: 'a.pdf',
    },
    suggest,
  );

  assert.deepEqual(await called, []);
  await flush();
  assert.deepEqual(fake.state.storage.courses['999'], { name: '', folder: '' });
  assert.equal(fake.state.badgeText, '1');
});

test('falls back to the default filename when storage is unavailable', async () => {
  const fake = await loadBackground({ storage: named });
  fake.chrome.storage.sync.get = async () => {
    throw new Error('storage unavailable');
  };
  const logged = mock.method(console, 'error', () => {});
  const { suggest, called } = deferredSuggest();

  determineFilename(
    fake,
    {
      url: 'https://canvas.harvard.edu/courses/171357/files/1/download',
      referrer: '',
      filename: 'a.pdf',
    },
    suggest,
  );

  assert.deepEqual(await called, []);
  assert.equal(logged.mock.callCount(), 1);
  logged.mock.restore();
});

test('shows the number of unnamed courses on the badge after install', async () => {
  const fake = await loadBackground({
    storage: {
      courses: {
        1: { name: 'Named', folder: 'named' },
        2: { name: 'Only a Canvas name', folder: '' },
        3: { name: '', folder: '' },
      },
      autoNaming: false,
    },
  });

  fake.emit('runtime.onInstalled');
  await flush();

  assert.equal(fake.state.badgeText, '2');
  assert.equal(fake.state.badgeColor, '#d93025');
});

test('does not count courses that automatic naming can handle', async () => {
  const fake = await loadBackground({
    storage: {
      courses: { 2: { name: 'Only a Canvas name', folder: '' }, 3: { name: '', folder: '' } },
      autoNaming: true,
    },
  });

  fake.emit('runtime.onStartup');
  await flush();

  assert.equal(fake.state.badgeText, '1');
});

test('clears the badge once every course has a folder', async () => {
  const fake = await loadBackground({
    storage: { courses: { 1: { name: 'A', folder: '' } }, autoNaming: false },
  });
  fake.emit('runtime.onStartup');
  await flush();
  assert.equal(fake.state.badgeText, '1');

  await fake.chrome.storage.sync.set({ courses: { 1: { name: 'A', folder: 'a' } } });
  await flush();

  assert.equal(fake.state.badgeText, '');
});

test('opens the options page when the toolbar icon is clicked', async () => {
  const fake = await loadBackground();

  fake.emit('action.onClicked');
  await flush();

  assert.equal(fake.state.optionsPageOpens, 1);
});
