import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createFakeChrome, flush } from './helpers/fake-chrome.js';

const coursePage = `
  <nav id="breadcrumbs">
    <ul>
      <li><a href="/"><span>My Dashboard</span></a></li>
      <li><a href="/courses/171357"><span class="ellipsible">ECON 1011A: Intermediate Microeconomics</span></a></li>
      <li><a href="/courses/171357/files"><span>Files</span></a></li>
    </ul>
  </nav>`;

const courseUrl = 'https://canvas.harvard.edu/courses/171357/files/folder/Lecture%20Notes';

let instance = 0;

async function runContentScript({ url = courseUrl, html = coursePage, storage = {} }) {
  const dom = new JSDOM(html, { url });
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  const fake = createFakeChrome({ storage });
  globalThis.chrome = fake.chrome;
  await import(`../content.js?instance=${instance++}`);
  await flush();
  return fake;
}

test('records the course name from the breadcrumb, keeping the folder the user chose', async () => {
  const fake = await runContentScript({
    storage: { courses: { 171357: { name: '', folder: 'EC1011a' } } },
  });

  assert.deepEqual(fake.state.storage.courses['171357'], {
    name: 'ECON 1011A: Intermediate Microeconomics',
    folder: 'EC1011a',
  });
});

test('adds a course that has not been seen before', async () => {
  const fake = await runContentScript({});

  assert.deepEqual(fake.state.storage.courses, {
    171357: { name: 'ECON 1011A: Intermediate Microeconomics', folder: '' },
  });
});

test('does not write when the stored name is already current', async () => {
  const fake = await runContentScript({
    storage: {
      courses: { 171357: { name: 'ECON 1011A: Intermediate Microeconomics', folder: '' } },
    },
  });

  assert.equal(fake.state.writes, 0);
});

test('does nothing on a page without a course breadcrumb', async () => {
  const fake = await runContentScript({ html: '<h1>Loading…</h1>' });

  assert.equal(fake.state.writes, 0);
});

test('does nothing outside a course', async () => {
  const fake = await runContentScript({ url: 'https://canvas.harvard.edu/conversations' });

  assert.equal(fake.state.writes, 0);
});
