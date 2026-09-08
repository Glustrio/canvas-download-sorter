// Wrapped in a function so running it twice in the same page (declaratively and
// again via chrome.scripting after install) doesn't redeclare its variables.
(() => {
  const courseId = /^\/courses\/(\d+)/.exec(location.pathname)?.[1];
  const courseLink =
    courseId && document.querySelector(`#breadcrumbs a[href$="/courses/${courseId}"]`);
  const courseName = courseLink?.textContent.trim();

  if (courseName) {
    recordCourseName(courseId, courseName);
  }

  async function recordCourseName(id, name) {
    const { courses } = await chrome.storage.sync.get({ courses: {} });
    const course = courses[id] ?? { name: '', folder: '' };
    if (course.name === name) return;
    await chrome.storage.sync.set({ courses: { ...courses, [id]: { ...course, name } } });
  }
})();
