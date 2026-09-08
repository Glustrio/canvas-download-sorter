# Canvas Download Sorter

[![CI](https://github.com/Glustrio/canvas-download-sorter/actions/workflows/ci.yml/badge.svg)](https://github.com/Glustrio/canvas-download-sorter/actions/workflows/ci.yml)

A Chrome extension that saves files downloaded from Canvas into a folder for
each course.

Without it, every lecture slide and problem set lands in the root of your
Downloads folder. With it, a file from the EC1011a course page saves to
`EC1011a/lecture4.pdf`, a file from Math 21a saves to `Math 21a/pset3.pdf`, and
downloads from any other site are left exactly as they were.

It is set up for Harvard's Canvas (`canvas.harvard.edu`). See
[Using it at another school](#using-it-at-another-school).

## Install

The extension is not on the Chrome Web Store yet, so it is loaded from a folder:

1. Download the latest `canvas-download-sorter-<version>.zip` from the
   [Releases page](https://github.com/Glustrio/canvas-download-sorter/releases)
   and unzip it somewhere you'll keep it (Chrome loads the extension from that
   folder every time it starts). Developers can clone the repository instead.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.

Chrome may remind you at startup that you have extensions in developer mode.
That is expected for anything installed outside the Web Store.

## Set up

**Name your courses.** Open any course on Canvas, then click the extension's
toolbar icon. Every course you have opened — including tabs that were already
open when you installed — is listed with a box for its folder name. Type a short name such as `EC1011a` and press Enter. The badge on the
icon counts courses that still need a name; a download from an unnamed course
is saved where it would have gone anyway.

If you would rather not name them, turn on **Use the Canvas course name** on
the same page. Folders then get the full Canvas name, for example
`ECON 1011A Intermediate Microeconomics`.

Courses you remove from the list come back the next time you open them in
Canvas.

**Optional: sync the folders to other devices.** The extension can only create
folders inside Chrome's download location, so point that location at a synced
folder: Chrome menu › Settings › Downloads › Location › **Change**, then pick a
folder inside iCloud Drive, Dropbox or Google Drive. All of Chrome's downloads
go there from then on, with Canvas files sorted into course subfolders.

## How it works

Chrome asks extensions for a filename just before a download starts
(`chrome.downloads.onDeterminingFilename`). If the download came from Canvas,
the extension reads the course ID from the URL — every Canvas course URL looks
like `canvas.harvard.edu/courses/171357/…` — looks up the folder name for that
course and answers with `EC1011a/<original filename>`. Chrome creates the
folder if it does not exist. When the download URL has no course in it, the
referrer and then the active tab are checked.

Course names are collected by a content script that runs on Canvas course
pages and reads the course link in the breadcrumb. That is why a course appears
in the settings as soon as you open it, before you have downloaded anything.

The reasoning behind these choices is in [docs/design.md](docs/design.md).

## Permissions

| Permission                     | Why                                                                        |
| ------------------------------ | -------------------------------------------------------------------------- |
| `downloads`                    | To be asked for a filename when a download starts.                         |
| `storage`                      | To remember course names, folder names and the automatic-naming setting.   |
| `scripting`                    | To read course names from Canvas tabs that were already open at install.   |
| `https://canvas.harvard.edu/*` | To read course names on Canvas pages and the URL of the active Canvas tab. |

Nothing leaves your browser. The extension makes no network requests of its
own.

## Using it at another school

Replace `canvas.harvard.edu` in two files: the `host_permissions` and
`content_scripts` entries in `manifest.json`, and `CANVAS_HOST` in
`sorter.js`. Then reload the extension.

## Development

```
npm install
npm test          # unit tests
npm run lint
npm run test:e2e  # real-browser test, see below
```

The decision logic lives in `sorter.js` and has no Chrome dependencies. The
service worker, content script and options page are tested against a small
in-memory fake of the `chrome` API (`test/helpers/fake-chrome.js`) and jsdom.

`npm run test:e2e` loads the extension into Chrome for Testing, serves a fake
Canvas over HTTPS from the test process, and checks where downloaded files
actually land — including a download that redirects to a CDN host, as real
Canvas file links do. It downloads Chrome for Testing (about 150 MB) into
`~/.cache/puppeteer` the first time, or uses the binary named by `CHROME_PATH`.
It needs Node 22 or newer and `openssl` on the path. No Canvas login is
involved.

After changing the code, click the reload icon on the extension's card in
`chrome://extensions`.

## Releasing

Bump the version in `manifest.json` and `package.json`
(`npm version 1.2.0 --no-git-tag-version` updates the latter), commit, then tag
and push:

```
git tag v1.2.0
git push origin v1.2.0
```

The Release workflow runs the tests, builds the zip with `npm run package` and
publishes it on the Releases page. Steps for the Chrome Web Store are in
[docs/chrome-web-store.md](docs/chrome-web-store.md).

## License

[MIT](LICENSE)
