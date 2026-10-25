# Mitsubishi OUTLANDER Service Manual

Responsive static website for the N5 workshop manual and N8 pre-delivery inspection and periodic maintenance manual.

## Included features

- Responsive layouts for mobile, tablet, and desktop.
- WebP illustrations at their original resolution, including transparency and animations.
- Offline PWA support for previously viewed content, with a 200 MiB runtime cache limit.
- Existing chapter URLs, search, bookmarks, illustration zoom, and printing.

The 11,190 converted illustrations total **422,052,160 bytes**. The website export, before these repository metadata files, totals **533,748,156 bytes**.

This repository and its GitHub Pages website are public.

**Open the website:** <https://root50643.github.io/mitsubishi-outlander-manual/>

GitHub Pages publishes the root directory of the `main` branch over HTTPS.

## Local preview

From this repository directory, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>. PWA installation and service workers require HTTPS or a localhost preview. Supported mobile browsers provide installation through their app or share menus.

The root `index.html` opens N5. N8 is available through the manual type selector or `moca/N8/index/index.html`.

This repository contains the prepared website only. Original PNG illustrations, the Windows viewer, build caches, local reports, and the duplicate ZIP archive are not included. To update the website, replace its files with a newly verified export, then commit and push. Publishing settings are managed separately.
