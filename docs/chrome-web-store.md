# Publishing to the Chrome Web Store

Everything in this file can be copied into the
[developer dashboard](https://chrome.google.com/webstore/devconsole). The
account itself has to belong to the person publishing.

## Account

- The Google account needs **2-Step Verification** turned on; the store refuses
  to publish without it.
- Register as a developer (one-time US$5 fee). The developer email you register
  with cannot be changed later, so pick one you will keep.
- Under **Account**, add and verify a contact email — it is shown publicly on
  the listing.
- If asked whether you are a _trader_ (an EU consumer-law question), an
  individual who is not selling anything is a **non-trader**.

## Files

| What                                 | Where it comes from                                                 |
| ------------------------------------ | ------------------------------------------------------------------- |
| Package (zip)                        | `npm run package` → `dist/canvas-download-sorter-<version>.zip`     |
| Store icon, 128×128                  | `icons/icon-128.png` (96×96 artwork with 16px padding)              |
| Screenshot, 1280×800                 | `npm run screenshot` → `docs/store/screenshot-options-1280x800.png` |
| Small promo tile, 440×280 (required) | `docs/store/promo-440x280.png`                                      |

At least one screenshot is required; up to five are allowed.

## Store listing tab

**Title** comes from the manifest: _Download Sorter for Canvas_. Third-party
names are used in the "… for X" form the stores recommend for compatibility,
with the trademark attribution below.

**Summary** (132 characters max):

> Saves files you download from Canvas into a folder for each course, automatically.

**Description:**

> Every lecture slide and problem set you download from Canvas lands in the root
> of your Downloads folder. Download Sorter for Canvas files each one into a
> folder named after its course instead.
>
> • Name each course's folder once on the settings page, or turn on automatic
> naming to use the Canvas course name.
> • Works with Chrome's normal download location. Point that at a folder in
> iCloud Drive, Dropbox or Google Drive and your class folders sync to your
> other devices.
> • Downloads from any other site are left exactly as they were.
> • Nothing leaves your browser: no accounts, no servers, no analytics. Course
> and folder names are kept in Chrome's extension storage only.
>
> Built for Harvard's Canvas (canvas.harvard.edu). Open source:
> https://github.com/Glustrio/canvas-download-sorter
>
> Canvas is a trademark of Instructure, Inc. This extension is an independent
> project and is not affiliated with or endorsed by Instructure or Harvard
> University.

**Category:** Productivity › Education. **Language:** English (United States).

**Official URL / Homepage:** https://github.com/Glustrio/canvas-download-sorter
**Support URL:** https://github.com/Glustrio/canvas-download-sorter/issues

## Privacy practices tab

**Single purpose:**

> Saves files downloaded from Canvas into a folder named after the course they
> came from.

**Permission justifications:**

- `downloads` — Chrome asks the extension for a filename when a download
  starts; this is how the course folder is added to the path. The extension
  does not start, cancel or read the contents of downloads.
- `storage` — remembers course names, the folder name chosen for each course
  and the automatic-naming setting.
- `scripting` — runs the same content script in Canvas course tabs that were
  already open when the extension was installed, so they appear in the
  settings without a reload.
- Host permission `https://canvas.harvard.edu/*` — reads the course name from
  the breadcrumb on Canvas course pages, and reads the URL of the active
  Canvas tab when a download URL does not itself say which course it belongs
  to. No other site is accessed.

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Website content** (course names read from Canvas pages,
stored in Chrome's extension storage on the user's device). Nothing else is
collected, and nothing is transmitted. Certify all three statements (no sale or
transfer to third parties, no use unrelated to the single purpose, no use for
creditworthiness or lending) — they are all true.

**Privacy policy URL:**
https://github.com/Glustrio/canvas-download-sorter/blob/main/PRIVACY.md

## Distribution tab

Visibility **Public**, all regions, free.

## Why this should pass review

Checked against Google's published
[violation codes](https://developer.chrome.com/docs/webstore/troubleshooting):

- _Purple Potassium_ (unused or excessive permissions): all four permissions
  are used, none is broad, and each is justified above.
- _Purple Lithium / Purple Nickel_ (privacy policy, prominent disclosure): the
  policy is linked, and the settings page itself states that nothing leaves the
  browser — the in-product disclosure the
  [2026 policy update](https://developer.chrome.com/blog/cws-policy-updates-2026)
  asks for.
- _Yellow Zinc_ (unclear metadata): the title says what it does, the screenshot
  shows the real settings page, the description is specific.
- _Red Nickel / Red Silicon_ (implied endorsement): "for Canvas" phrasing and
  an explicit trademark and non-affiliation note.
- _Red Titanium_ (obfuscation): the package contains the readable source, not
  even minified.
- _Yellow Potassium_ (minimum functionality): the extension does real work on
  its own.

## After submitting

First reviews typically take a few days, sometimes longer. Do not upload a new
package while one is pending unless the review asks for changes. Once it is
live, replace the Install section of the README with the store link.

## Updating later

1. Bump `version` in `manifest.json` and `package.json`, tag and push
   (see the README's Releasing section).
2. `npm run package`, then **Package › Upload new package** in the dashboard.
3. Re-check the permission justifications if permissions changed; a new
   permission triggers a fresh review and a prompt for existing users.
