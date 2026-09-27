# Commander Tracker (EDH) — iPhone PWA

Static, dependency-free Progressive Web App for Magic: The Gathering Commander games.
Everything lives in `public/` (plain HTML/CSS/JS). There's no build step. Data is kept in `localStorage` on the device; optional online playgroups sync through Supabase (see below).

## Files
- `public/index.html`, `styles.css`, `app.js`: the app; `public/cloud.js`: online playgroups (Supabase data + offline sync)
- `public/sw.js`: service worker (offline cache). Bump `CACHE` when you deploy changes.
- `public/manifest.json`, `public/icons/`: PWA manifest + icons (180, 192, 512, maskable 512)
- `tools/test.mjs`: Playwright end-to-end test (iPhone 390x844). `tools/make-icons.mjs` regenerates the icons.
- `screenshots/`: screenshots from the test run
- `commander-tracker.zip`: contents of `public/`, ready to upload to any static host

## Run locally
    python3 -m http.server 8765 --directory public
    # then (needs playwright-core in tools/ and Chrome):
    node tools/test.mjs

## Hosting (needs a stable HTTPS URL — localStorage is tied to the origin)
Any static host works. Serve the contents of `public/` (or the zip) at a fixed URL, e.g.:
- GitHub Pages: push `public/` contents to a repo, then enable Pages. All paths are relative, so a `/repo/` subpath works.
- Netlify Drop (app.netlify.com/drop): drag the unzipped folder in.
- Cloudflare Pages / Vercel: upload the folder as a static site.

Once it's hosted, open the URL in Safari on the iPhone, then Share → Add to Home Screen.
Don't change the URL afterwards, or the data will be left behind at the old address. Use Settings → Export JSON for backups.

## Online playgroups (v1.2)
Optional. Without an account the app works exactly as before, 100% local.
- Backend: Supabase project `uxfcidiqagswxkntymmh` (eu-central-1). `public/cloud.js` holds the URL and the **publishable** key
  (client-safe; every table is protected by Row Level Security). Never put a service_role/secret key in this repo.
- supabase-js 2.117.2 is loaded from jsDelivr with an SRI hash; the service worker caches it so the app works offline.
- Sign-in (v1.2.1): **Continue with Google** (Supabase OAuth, PKCE, same-window redirect back to the app URL, which is
  inside the manifest scope so iOS returns to the Home Screen app). Needs: Google provider enabled with client ID/secret,
  Google OAuth client redirect URI `https://uxfcidiqagswxkntymmh.supabase.co/auth/v1/callback`, and Supabase →
  Authentication → URL Configuration: Site URL + Redirect URL `https://creepyfoxx.github.io/commander-tracker/**`.
  Secondary: username/email + password ("Other options"; new username accounts need "Confirm email" OFF). Google users can
  set an app password as a backup way in (sign in with their Google email).
- Playgroups: create one in Settings, share the invite code or link (`?join=CODE`). Members see each other's decks, the
  group's games and stats. Guests (people without the app) are remembered per group and get their own stats.
- Offline: finished games queue on the phone and upload automatically when the connection is back ("pending sync" pill).
- Tests: `tools/test.mjs` (local mode), `tools/test-online.mjs` (online flows; needs seeded test accounts).

## Login screen backgrounds (v1.3)
- Phone: `public/img/login-phone.jpg`, about 1290x2796 px, portrait (used below 768 px width).
- Tablet: `public/img/login-tablet.jpg`, about 2048x2732 px, portrait (used from 768 px width; in iPad landscape it is
  cropped with `background-size: cover`, so keep the subject near the centre).
- The current files are generated gradient placeholders (`tools/make-login-placeholders.mjs`). To swap: overwrite the two
  JPGs (sRGB, quality ~75-80, ideally < 500 KB each), bump `CACHE` in `public/sw.js`, deploy.
- Focal point for cropping: `--login-focus-phone` / `--login-focus-tablet` in `styles.css` (default `50% 35%`).
- A dark gradient overlay (`.login-shade`) keeps the text and buttons readable on any photo.
