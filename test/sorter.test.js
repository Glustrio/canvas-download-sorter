import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseIdFromUrl,
  isCanvasDownload,
  sanitizeFolderName,
  unnamedCourses,
  decide,
} from '../sorter.js';

const settings = {
  courses: {
    171357: { name: 'ECON 1011A: Intermediate Microeconomics', folder: 'EC1011a' },
    200001: { name: 'MATH 21A: Multivariable Calculus', folder: '' },
    200002: { name: '', folder: '' },
  },
  autoNaming: false,
};

const fileUrl = (courseId) =>
  `https://canvas.harvard.edu/courses/${courseId}/files/25672073/download?download_frd=1`;

test('courseIdFromUrl reads the id from a Canvas course URL', () => {
  assert.equal(
    courseIdFromUrl(
      'https://canvas.harvard.edu/courses/171357/files/folder/Lecture%20Notes?preview=1',
    ),
    '171357',
  );
  assert.equal(courseIdFromUrl('https://canvas.harvard.edu/courses/171357'), '171357');
});

test('courseIdFromUrl returns null for non-course, non-Canvas or malformed URLs', () => {
  assert.equal(courseIdFromUrl('https://canvas.harvard.edu/files/25672073/download'), null);
  assert.equal(courseIdFromUrl('https://example.com/courses/171357'), null);
  assert.equal(courseIdFromUrl('not a url'), null);
  assert.equal(courseIdFromUrl(undefined), null);
});

test('isCanvasDownload accepts a Canvas URL or referrer and nothing else', () => {
  assert.equal(isCanvasDownload({ url: fileUrl(1), referrer: '' }), true);
  assert.equal(
    isCanvasDownload({
      url: 'https://files.example.com/x.pdf',
      referrer: 'https://canvas.harvard.edu/courses/1',
    }),
    true,
  );
  assert.equal(
    isCanvasDownload({ url: 'https://example.com/x.pdf', referrer: 'https://example.com/' }),
    false,
  );
  assert.equal(isCanvasDownload({ url: 'https://example.com/x.pdf', referrer: undefined }), false);
});

test('sanitizeFolderName removes characters that are invalid in file names', () => {
  assert.equal(
    sanitizeFolderName('ECON 1011A: Intermediate Microeconomics'),
    'ECON 1011A Intermediate Microeconomics',
  );
  assert.equal(sanitizeFolderName('  CS50 / Intro   to  CS  '), 'CS50 Intro to CS');
  assert.equal(sanitizeFolderName('..hidden...'), 'hidden');
  assert.equal(sanitizeFolderName(':::'), '');
});

test('unnamedCourses lists courses without a folder, honouring automatic naming', () => {
  assert.deepEqual(unnamedCourses(settings), ['200001', '200002']);
  assert.deepEqual(unnamedCourses({ ...settings, autoNaming: true }), ['200002']);
});

test('decide ignores downloads that did not come from Canvas, even with a Canvas tab active', () => {
  const download = {
    url: 'https://example.com/paper.pdf',
    referrer: 'https://example.com/',
    tabUrl: 'https://canvas.harvard.edu/courses/171357',
    filename: 'paper.pdf',
  };
  assert.deepEqual(decide(download, settings), { kind: 'ignore' });
});

test('decide sorts a Canvas file into the course folder', () => {
  const download = {
    url: fileUrl(171357),
    referrer: '',
    tabUrl: undefined,
    filename: 'lecture4.pdf',
  };
  assert.deepEqual(decide(download, settings), {
    kind: 'sort',
    courseId: '171357',
    filename: 'EC1011a/lecture4.pdf',
  });
});

test('decide falls back to the referrer, then the active tab, for the course id', () => {
  const download = {
    url: 'https://canvas.harvard.edu/files/25672073/download?verifier=abc',
    filename: 'lecture4.pdf',
  };
  assert.equal(
    decide({ ...download, referrer: 'https://canvas.harvard.edu/courses/171357/files' }, settings)
      .filename,
    'EC1011a/lecture4.pdf',
  );
  assert.equal(
    decide(
      {
        ...download,
        referrer: 'https://canvas.harvard.edu/',
        tabUrl: 'https://canvas.harvard.edu/courses/171357/modules',
      },
      settings,
    ).filename,
    'EC1011a/lecture4.pdf',
  );
});

test('decide ignores Canvas downloads with no course anywhere', () => {
  const download = {
    url: 'https://canvas.harvard.edu/files/1/download',
    referrer: 'https://canvas.harvard.edu/conversations',
    tabUrl: 'https://canvas.harvard.edu/conversations',
    filename: 'a.pdf',
  };
  assert.deepEqual(decide(download, settings), { kind: 'ignore' });
});

test('decide reports an unnamed course rather than guessing a folder', () => {
  assert.deepEqual(decide({ url: fileUrl(200001), filename: 'a.pdf' }, settings), {
    kind: 'unnamed',
    courseId: '200001',
  });
  assert.deepEqual(decide({ url: fileUrl(999), filename: 'a.pdf' }, settings), {
    kind: 'unnamed',
    courseId: '999',
  });
});

test('decide uses the sanitized Canvas name when automatic naming is on', () => {
  const auto = { ...settings, autoNaming: true };
  assert.equal(
    decide({ url: fileUrl(200001), filename: 'a.pdf' }, auto).filename,
    'MATH 21A Multivariable Calculus/a.pdf',
  );
  assert.equal(decide({ url: fileUrl(200002), filename: 'a.pdf' }, auto).kind, 'unnamed');
});

test('decide keeps only the base name of the filename Chrome proposes', () => {
  assert.equal(
    decide({ url: fileUrl(171357), filename: 'sub/dir/notes.pdf' }, settings).filename,
    'EC1011a/notes.pdf',
  );
  assert.equal(
    decide({ url: fileUrl(171357), filename: 'C:\\Users\\g\\notes.pdf' }, settings).filename,
    'EC1011a/notes.pdf',
  );
});
