# Commander Tracker (EDH) — iPhone PWA

Static, dependency-free Progressive Web App for Magic: The Gathering Commander games.
Everything lives in `public/` (plain HTML/CSS/JS). There's no build step. Data is kept in `localStorage` on the device; optional online playgroups sync through Supabase (see below).

## Files
- `public/index.html`, `styles.css`, `app.js`: the app; `public/cloud.js`: online playgroups (Supabase data + offline sync)
- `public/sw.js`: service worker (offline cache). Bump `CACHE` when you deploy changes.
- `public/manifest.json`, `public/icons/`: PWA manifest + icons (180, 192, 512, maskable 512)
- `tools/test.mjs`: Playwright end-to-end test (iPhone 390x844). `tools/make-icons.mjs` regenerates the icons; `tools/shot-standalone.mjs` renders the game with emulated iPhone safe areas; `tools/fixture-v1.json` is v1.0-format data used to test backward compatibility.
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

## Login screen backgrounds (v1.3, artwork since v1.3.1)
- Phone: `public/img/login-phone.jpg` (used below 768 px width). Tablet: `public/img/login-tablet.jpg` (from 768 px).
- v1.3.1: both files are the same 768x1152 (2:3) forest illustration (sRGB, q80, ~200 KB) with a round logo in the exact
  centre. The layout is tuned around that logo (see the comment in `styles.css`):
  - phone: brand at the top, buttons at the bottom, art zoomed from the top edge (`--login-zoom-phone`, 1.08) so the logo
    sits in the gap; the zoom is dropped while the invite banner is shown so the logo moves up clear of it.
  - tablet portrait: frosted card anchored at the bottom, art aligned to its bottom edge (`--login-focus-tablet: 50% 100%`)
    so the logo stays above the card.
  - tablet landscape (aspect >= 5:4): the whole picture as a full-height panel on the left (`.login-art`, width =
    height x `--login-art-ratio`, i.e. the image's width/height), blurred copy behind, card on the right.
- To swap: overwrite the JPGs (sRGB, quality ~75-80, < 500 KB each), bump `CACHE` in `public/sw.js`, deploy. If a new
  image has a different aspect ratio, update `--login-art-ratio`; if its subject is not centred, revisit the focal vars.
- Focal points: `--login-focus-phone` (`50% 50%`) / `--login-focus-tablet` (`50% 100%`) in `styles.css`.
- `.login-shade` darkens the top (brand text) and bottom (buttons) and stays clear over the logo band in the middle.
- `tools/shot-login.mjs [prefix]` renders the login at 402x812, 375x667, 820x1180 and 1180x820 (`INVITE=1` adds a
  sample invite banner). `tools/make-login-placeholders.mjs` regenerates the old gradient placeholders.
