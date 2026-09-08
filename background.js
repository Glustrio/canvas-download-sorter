import { decide, isCanvasDownload, unnamedCourses } from './sorter.js';

const DEFAULTS = { courses: {}, autoNaming: false };

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (!isCanvasDownload(item)) return false;

  // Chrome holds the download until suggest() is called; returning true tells it
  // that will happen asynchronously.
  suggestionFor(item)
    .catch((error) => {
      console.error('Using the default filename:', error);
      return undefined;
    })
    .then((suggestion) => (suggestion ? suggest(suggestion) : suggest()));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener(updateBadge);

async function suggestionFor(item) {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const download = {
    url: item.url,
    referrer: item.referrer,
    tabUrl: await activeTabUrl(),
    filename: item.filename,
  };
  const result = decide(download, settings);

  if (result.kind === 'unnamed') {
    await rememberCourse(result.courseId, settings.courses);
  }
  if (result.kind === 'sort') {
    return { filename: result.filename, conflictAction: 'uniquify' };
  }
  return undefined;
}

async function activeTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.url;
}

// A course the user has downloaded from but never opened a page of still needs
// to show up on the options page so it can be named.
async function rememberCourse(courseId, courses) {
  if (courses[courseId]) return;
  await chrome.storage.sync.set({
    courses: { ...courses, [courseId]: { name: '', folder: '' } },
  });
}

async function updateBadge() {
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const count = unnamedCourses(settings).length;
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
}
