export const CANVAS_HOST = 'canvas.harvard.edu';

const COURSE_PATH = /^\/courses\/(\d+)(?:\/|$)/;
// Characters that are invalid in a file name on macOS, Windows or Linux.
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\p{Cc}]/gu;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCanvasUrl(value) {
  return parseUrl(value)?.hostname === CANVAS_HOST;
}

function baseName(path) {
  return path.split(/[\\/]/).pop();
}

export function courseIdFromUrl(value) {
  const url = parseUrl(value);
  if (url?.hostname !== CANVAS_HOST) return null;
  return COURSE_PATH.exec(url.pathname)?.[1] ?? null;
}

export function isCanvasDownload({ url, referrer }) {
  return isCanvasUrl(url) || isCanvasUrl(referrer);
}

export function sanitizeFolderName(name) {
  return name
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

export function folderFor(courseId, { courses, autoNaming }) {
  const course = courses[courseId];
  if (!course) return '';
  if (course.folder) return course.folder;
  return autoNaming ? sanitizeFolderName(course.name) : '';
}

export function unnamedCourses(settings) {
  return Object.keys(settings.courses).filter((id) => !folderFor(id, settings));
}

export function decide(download, settings) {
  if (!isCanvasDownload(download)) return { kind: 'ignore' };

  const courseId =
    courseIdFromUrl(download.url) ??
    courseIdFromUrl(download.referrer) ??
    courseIdFromUrl(download.tabUrl);
  if (!courseId) return { kind: 'ignore' };

  const folder = folderFor(courseId, settings);
  if (!folder) return { kind: 'unnamed', courseId };

  return { kind: 'sort', courseId, filename: `${folder}/${baseName(download.filename)}` };
}
