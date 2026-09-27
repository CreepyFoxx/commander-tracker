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

## Login screen backgrounds (v1.3, artwork since v1.3.1, upscaled/expanded in v1.3.2)
- Phone: `public/img/login-phone.jpg` (used below 768 px width). Tablet: `public/img/login-tablet.jpg` (from 768 px).
- Source: a 768x1152 (2:3) forest illustration with a round logo in the exact centre.
  - phone file (v1.3.2): Real-ESRGAN x4 anime model (3072x4608), downscaled to 1290x1935, q80 4:4:4, ~465 KB.
  - tablet file (v1.3.2): the picture outpainted to 1936x1344 (original units; extra forest mostly to the right, some left,
    top and bottom) with Stable Diffusion 1.5 inpainting (DreamShaper 8), upscaled x4 with the same Real-ESRGAN model,
    the upscaled original pasted back over its area (feathered 40 px), exported 2580x1791 q80, ~480 KB. The logo sits at
    x .3298 / y .504 of the image (`--login-tablet-logo-x/-y`), aspect `--login-tablet-ratio` 1.4405.
- Layout (see the comment in `styles.css`):
  - phone: brand at the top, buttons at the bottom, art zoomed from the top edge (`--login-zoom-phone`, 1.08) so the logo
    sits in the gap; the zoom is dropped while the invite banner is shown so the logo moves up clear of it.
  - tablet: the expanded art always covers the screen; size/position are computed with `calc()` so the logo lands at
    `--login-tablet-at-x`. Portrait: logo centred, art zoomed (`--login-tablet-zoom` 1.15) and bottom-aligned so the logo
    sits above the frosted card anchored at the bottom. Landscape (>= 5:4): logo at ~32% across, card on the right.
- To swap: overwrite the JPGs (sRGB, quality ~75-80, < 500 KB each), bump `CACHE` in `public/sw.js`, deploy. A new
  tablet image needs matching `--login-tablet-ratio` and `--login-tablet-logo-x/-y` (and the logo box in `tools/test.mjs`).
- `.login-shade` darkens the top (brand text) and bottom (buttons) and stays clear over the logo band in the middle.
- `tools/shot-login.mjs [prefix]` renders the login at 402x812, 375x667, 820x1180 and 1180x820 (`INVITE=1` adds a
  sample invite banner, `EXTRA=1` adds 768x1024, 1024x768, 1024x1366, 1366x1024, 1440x900). `tools/make-login-placeholders.mjs` regenerates the old gradient placeholders.

## Visual design (v1.4)
- One set of design tokens at the top of `public/styles.css` (colours, radii `--r-xs…--r-xl`, shadows, `--font` = SF / system,
  `--font-num` = SF Rounded for numbers, easing/durations). Dark theme with purple-tinted surfaces and violet / cyan / orange
  glow accents to match the login artwork; seat colours keep their own `--accent-s` / `--glow-s`.
- Icons are inline SVG in the `I` object in `app.js` (no emoji for UI chrome, no external assets). Stats use win-rate bars
  with a "fair share" baseline marker (1 / average players), mana-coloured bars, win-rate rings on commander cards and
  deck colour strips. View changes use a short fade/slide that is disabled under `prefers-reduced-motion`.
- On iPad (>= 1000px wide) Stats, History and Commanders use two columns.
- `tools/shot-ui.mjs <prefix>` seeds demo data and screenshots every main screen at 402x812 (standalone), 375x667,
  820x1180 and 1180x820 (`ONLY=phone,ipad` to limit). The v1.4 before/after set is `screenshots/33-before-*` / `33-after-*`.


## QA pass (v1.4.1)
- Fixed: deleting a group game while it was uploading could drop the *next* queued game (sync now removes exactly the
  item it uploaded; a game deleted mid-upload is deleted right after it lands). "Restart" now starts a clean game (no
  stale first player). Double-tapping "Start game" no longer opens a "discard?" dialog over the new game. Long names no
  longer push the end-game winner list off screen. Draws show a neutral result. Stats hide empty colour/commander charts
  when no commanders were recorded.
- Polish: slimmer icon-only status chips on narrow panels (5-6 players on a phone), commander chart with full-width names,
  iPad-landscape stats in two balanced columns, 40px+ tap targets for segmented controls / small buttons / links,
  accessible names on all icon buttons and colour toggles, keyboard focus ring, higher-contrast secondary text, no
  roulette flashing under reduced motion, theme colour matches the app background.
- `tools/qa-explore.mjs` (long/emoji names, 6 players on 375x667, rapid taps, reload, iPad rotation, tap targets, unnamed
  buttons) and `tools/qa-flows.mjs` (poison, concede, restart, draw, double submit, backup round trip) are exploratory
  scripts (`OUT=/tmp/qa`, `URL=` to point them at the live site); the regressions they found are covered in `test.mjs` /
  `test-online.mjs`.

## Turn order & turn-1 Sol Ring (v1.5.0)
- **End game screen**: a *Turn order* row shows who played 1st, 2nd, … (seats go clockwise, the order the app already uses
  for the table layout). It starts from the random first player (or the one picked from the game menu); if nobody was
  picked, seat 1 is assumed and a note says so. Tap a player to say they went first — the others follow clockwise.
  Below it, *Turn 1 Sol Ring?* has one toggle per player (default off).
- **In game**: each player's ⋯ sheet has a *T1 Sol Ring* toggle next to Monarch / Initiative. When on, a small Sol Ring
  badge shows on that panel and the end-game toggle is already ticked. Restart clears it.
- **Stored per game** (backward compatible, nothing is rewritten): `firstPlayerIndex` on the game, and per player
  `turnPos` (1..N) and `solRingT1` (true/false); `wentFirst` is kept in sync. Older games simply lack them and are left
  out of these stats. Backups (export/import) carry the fields as-is.
- **Supabase**: migration `games_turn_order_sol_ring` adds the nullable column `games.first_player_index` (check:
  `0 <= index < player_count`); `turnPos` / `solRingT1` travel inside the existing `players` JSON. RLS unchanged (the
  existing member-insert / member-read / recorder-delete policies cover the new column). `cloud.js` maps
  `firstPlayerIndex` ↔ `first_player_index`; the offline queue stores whole game objects, so queued games keep the data.
- **Stats** (Group / My stats scope respected):
  - *Win rate by turn position*: wins/games and % for 1st…Nth to play, with a pod-size selector (defaults to the most
    common size; *All* mixes sizes), a fair-share marker, and a per-player / per-commander table (My stats: my decks).
  - *Turn 1 Sol Ring*: % of games with one, how many times, % of players; win rate with vs without; per player /
    commander table (times, win % with, win % without).
  - A note shows how many games are counted ("Based on 21 of 27 games — games saved before this update aren't counted").
    With no tracked games yet the sections are replaced by a one-paragraph explanation.
  - Commander / deck detail sheets show win rate per turn position and turn-1 Sol Ring count; History shows a ▶N badge
    (turn position) and a Sol Ring badge per player.
- `tools/seed-v15.mjs` builds demo data (tracked 3- and 4-player games plus older untracked ones) for tests/screenshots.
