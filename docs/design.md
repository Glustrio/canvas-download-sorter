# Design notes

## Goal

When a file is downloaded from Canvas (`canvas.harvard.edu`), save it into a
subfolder named after the course instead of the root of the download folder.
Downloads from anywhere else are left alone.

## The constraint that shapes everything

Chrome extensions cannot write to arbitrary locations on disk. The only hook
is `chrome.downloads.onDeterminingFilename`, which lets an extension suggest a
filename _relative to Chrome's download directory_, optionally with
subdirectories. So the extension can produce `EC1011a/lecture4.pdf`, but never
`~/Documents/EC1011a/lecture4.pdf`.

To get files onto other devices, the user points Chrome's download location at
a folder inside iCloud Drive. The extension doesn't know or care where that
folder is.

## Working out which course a download belongs to

Canvas URLs carry the course ID: `https://canvas.harvard.edu/courses/171357/...`.
The download's original URL (before Canvas redirects to its file CDN) usually
contains it. When it doesn't — some file links are `/files/<id>/download`
with no course segment — fall back to the referrer, then to the URL of the
active tab.

A download counts as a Canvas download only if its URL or referrer is on the
Canvas host. The active tab is used to find the course, never to decide
whether something is a Canvas download; otherwise any download started while
a Canvas tab happens to be focused would get sorted.

## Folder names

Canvas course names are long (`ECON 1011A: Intermediate Microeconomics: Advanced`),
so by default the user names each course's folder once on the options page.
An "automatic naming" toggle, off by default, uses the Canvas name for any
course the user hasn't named.

Course names come from a content script that runs on course pages and reads
the course link in the breadcrumb. This means a course appears on the options
page as soon as the user opens it in Canvas, before any download.

Folder names are sanitized for characters that are invalid on macOS, Windows,
or Linux, since the same iCloud folder may be opened on all of them.

## Storage

`chrome.storage.sync`, one object:

```json
{
  "courses": {
    "171357": { "name": "ECON 1011A: Intermediate Microeconomics", "folder": "EC1011a" }
  },
  "autoNaming": false
}
```

`name` is filled by the content script; `folder` by the user. A course with an
empty `folder` (and no automatic name) is "unnamed".

## Badge

The toolbar badge shows the number of unnamed courses. Clicking the icon opens
the options page. A download from an unnamed course saves to the root of the
download folder as it would without the extension.

## Non-goals

- Moving files outside the download directory.
- Supporting several Canvas hosts at once. The host is a constant; change it
  and the `host_permissions` entry to use another school's Canvas.
- Renaming the files themselves.

## Testing

The decision logic (`sorter.js`) has no Chrome dependencies and is covered by
`node --test`. The service worker, content script and options page are thin
wrappers around it, tested against an in-memory fake of the `chrome` API and
jsdom.

An end-to-end test (`npm run test:e2e`) loads the extension into Chrome for
Testing and drives it over the DevTools protocol against a fake Canvas served
from the test process, with `--host-resolver-rules` pointing
`canvas.harvard.edu` at it. It covers what the unit tests cannot: that Chrome
accepts the manifest, that a suggested `folder/name.pdf` really creates the
folder, that the extension sees the pre-redirect URL, and that the content
script's match pattern fires on course pages.
