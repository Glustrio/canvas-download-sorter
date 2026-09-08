# Publishing to the Chrome Web Store

Everything below except the developer account can be prepared from this
repository. Google requires the account and the one-time US$5 registration fee
to be set up by the person publishing.

## One-time setup

1. Sign in to the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   with a Google account and pay the registration fee.
2. Under **Account**, set a contact email and verify it.

## Each release

1. Build the zip: `npm run package` (writes `dist/canvas-download-sorter-<version>.zip`).
   The version comes from `manifest.json`; bump it before packaging.
2. In the dashboard, **New item** (first time) or **Package › Upload new package**.
3. Fill in the listing from the text below, add at least one screenshot
   (1280×800 or 640×400 PNG — the options page with a few named courses works),
   and submit for review. First reviews usually take a few days.

## Listing text

**Name:** Canvas Download Sorter

**Summary** (132 characters max):
Saves files you download from Canvas into a folder for each course, automatically.

**Description:**

Every lecture slide and problem set you download from Canvas lands in the root
of your Downloads folder. Canvas Download Sorter files each one into a folder
named after its course instead.

- Name each course's folder once on the settings page (or turn on automatic
  naming to use the Canvas course name).
- Works with Chrome's normal download location. Point that at a folder in
  iCloud Drive, Dropbox or Google Drive and your class folders sync to your
  other devices.
- Downloads from any other site are left exactly as they were.
- Nothing leaves your browser: no accounts, no servers, no analytics.

Built for Harvard's Canvas (canvas.harvard.edu). The source code is at
https://github.com/Glustrio/canvas-download-sorter.

**Category:** Productivity › Workflow & Planning

**Language:** English

## Privacy tab

**Single purpose:** Save files downloaded from Canvas into a folder per course.

**Permission justifications:**

- `downloads` — to be asked for a filename when a download starts, so the
  extension can add the course folder to it.
- `storage` — to remember course names, the folder names the user chooses and
  the automatic-naming setting.
- `scripting` — to read course names from Canvas tabs that were already open
  when the extension was installed.
- Host permission `https://canvas.harvard.edu/*` — to read course names on
  Canvas course pages and to identify the active Canvas tab for downloads.

**Data usage:** the extension does not collect or transmit user data. Course and
folder names are stored in Chrome's extension storage only.

**Privacy policy URL:**
https://github.com/Glustrio/canvas-download-sorter/blob/main/PRIVACY.md
