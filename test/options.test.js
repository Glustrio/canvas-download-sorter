import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createFakeChrome, flush } from './helpers/fake-chrome.js';

const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');

const threeCourses = {
  courses: {
    200001: { name: 'MATH 21A', folder: '' },
    171357: { name: 'ECON 1011A', folder: 'EC1011a' },
    300: { name: '', folder: '' },
  },
  autoNaming: false,
};

let instance = 0;

async function openOptionsPage(storage) {
  const dom = new JSDOM(html);
  globalThis.document = dom.window.document;
  const fake = createFakeChrome({ storage });
  globalThis.chrome = fake.chrome;
  await import(`../options.js?instance=${instance++}`);
  await flush();

  const { document } = dom.window;
  return {
    fake,
    document,
    rows: () => [...document.querySelectorAll('#courses tbody tr')],
    fire: (element, type) => element.dispatchEvent(new dom.window.Event(type, { bubbles: true })),
  };
}

test('adds a row when a course is recorded while the page is open', async () => {
  const { fake, rows } = await openOptionsPage(threeCourses);

  await fake.chrome.storage.sync.set({
    courses: { ...threeCourses.courses, 400: { name: 'GOV 20', folder: '' } },
  });
  await flush();

  assert.deepEqual(
    rows().map((row) => row.querySelector('.course-name').textContent),
    ['Course 300', 'ECON 1011A', 'GOV 20', 'MATH 21A'],
  );
});

test('does not rebuild the list when only a folder name changes', async () => {
  const { rows, fire } = await openOptionsPage(threeCourses);
  const input = rows()[2].querySelector('.folder');

  input.value = 'Math';
  fire(input, 'change');
  await flush();

  assert.equal(rows()[2].querySelector('.folder'), input);
});

test('lists courses sorted by name, with a placeholder for courses without one', async () => {
  const { document, rows } = await openOptionsPage(threeCourses);

  assert.deepEqual(
    rows().map((row) => row.querySelector('.course-name').textContent),
    ['Course 300', 'ECON 1011A', 'MATH 21A'],
  );
  assert.deepEqual(
    rows().map((row) => row.querySelector('.folder').value),
    ['', 'EC1011a', ''],
  );
  assert.equal(document.getElementById('courses').hidden, false);
  assert.equal(document.getElementById('empty').hidden, true);
});

test('shows the empty state when no courses are stored', async () => {
  const { document } = await openOptionsPage({});

  assert.equal(document.getElementById('courses').hidden, true);
  assert.equal(document.getElementById('empty').hidden, false);
});

test('reflects the stored automatic naming setting', async () => {
  const { document } = await openOptionsPage({ ...threeCourses, autoNaming: true });

  assert.equal(document.getElementById('auto-naming').checked, true);
});

test('saves a sanitized folder name when an input changes and confirms briefly', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const { document, fake, rows, fire } = await openOptionsPage(threeCourses);
  const input = rows()[2].querySelector('.folder');

  input.value = ' Math: 21a ';
  fire(input, 'change');
  await flush();

  assert.equal(input.value, 'Math 21a');
  assert.deepEqual(fake.state.storage.courses['200001'], { name: 'MATH 21A', folder: 'Math 21a' });
  assert.equal(document.getElementById('status').textContent, 'Saved');

  mock.timers.tick(2000);
  assert.equal(document.getElementById('status').textContent, '');
  mock.timers.reset();
});

test('removes a course from the list and from storage', async () => {
  const { fake, rows, fire } = await openOptionsPage(threeCourses);

  fire(rows()[0].querySelector('.remove'), 'click');
  await flush();

  assert.deepEqual(
    rows().map((row) => row.dataset.courseId),
    ['171357', '200001'],
  );
  assert.deepEqual(Object.keys(fake.state.storage.courses).sort(), ['171357', '200001']);
});

test('shows the empty state after the last course is removed', async () => {
  const { document, rows, fire } = await openOptionsPage({
    courses: { 1: { name: 'Only', folder: '' } },
    autoNaming: false,
  });

  fire(rows()[0].querySelector('.remove'), 'click');
  await flush();

  assert.equal(document.getElementById('courses').hidden, true);
  assert.equal(document.getElementById('empty').hidden, false);
});

test('saves the automatic naming toggle', async () => {
  const { document, fake, fire } = await openOptionsPage(threeCourses);
  const toggle = document.getElementById('auto-naming');

  toggle.checked = true;
  fire(toggle, 'change');
  await flush();

  assert.equal(fake.state.storage.autoNaming, true);
});
