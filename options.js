import { sanitizeFolderName } from './sorter.js';

const DEFAULTS = { courses: {}, autoNaming: false };

const table = document.getElementById('courses');
const tbody = table.querySelector('tbody');
const emptyState = document.getElementById('empty');
const autoNaming = document.getElementById('auto-naming');
const statusLine = document.getElementById('status');
const rowTemplate = document.getElementById('course-row');

function render({ courses, autoNaming: enabled }) {
  autoNaming.checked = enabled;

  const rows = Object.entries(courses)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, course]) => courseRow(id, course));
  tbody.replaceChildren(...rows);
  toggleEmptyState();
}

function courseRow(id, course) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.courseId = id;
  row.querySelector('.course-name').textContent = course.name || `Course ${id}`;
  row.querySelector('.folder').value = course.folder;
  return row;
}

function toggleEmptyState() {
  table.hidden = tbody.children.length === 0;
  emptyState.hidden = !table.hidden;
}

let statusTimer;
function flash(message) {
  statusLine.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusLine.textContent = '';
  }, 2000);
}

tbody.addEventListener('change', async (event) => {
  if (!event.target.matches('.folder')) return;
  const id = event.target.closest('tr').dataset.courseId;
  const folder = sanitizeFolderName(event.target.value);
  event.target.value = folder;

  const { courses } = await chrome.storage.sync.get(DEFAULTS);
  if (!courses[id]) return;
  await chrome.storage.sync.set({ courses: { ...courses, [id]: { ...courses[id], folder } } });
  flash('Saved');
});

tbody.addEventListener('click', async (event) => {
  if (!event.target.matches('.remove')) return;
  const row = event.target.closest('tr');

  const { courses } = await chrome.storage.sync.get(DEFAULTS);
  delete courses[row.dataset.courseId];
  await chrome.storage.sync.set({ courses });
  row.remove();
  toggleEmptyState();
});

autoNaming.addEventListener('change', async () => {
  await chrome.storage.sync.set({ autoNaming: autoNaming.checked });
  flash('Saved');
});

// Courses can appear while this page is open (the content script records them).
// Re-render only when the set of courses changes, so typing isn't interrupted.
chrome.storage.onChanged.addListener((changes) => {
  if (!changes.courses) return;
  const shown = [...tbody.children]
    .map((row) => row.dataset.courseId)
    .sort()
    .join();
  const stored = Object.keys(changes.courses.newValue ?? {})
    .sort()
    .join();
  if (shown !== stored) chrome.storage.sync.get(DEFAULTS).then(render);
});

chrome.storage.sync.get(DEFAULTS).then(render);
