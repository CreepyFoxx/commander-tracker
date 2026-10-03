# Commander Tracker (EDH) — iPhone PWA

Static, dependency-free Progressive Web App for Magic: The Gathering Commander games.
Everything lives in `public/` (plain HTML/CSS/JS). There's no build step. Data is kept in `localStorage` on the device; optional online playgroups sync through Supabase (see below).

## Files
- `public/index.html`, `styles.css`, `app.js`: the app; `public/cloud.js`: online playgroups (Supabase data + offline sync); `public/import.js`: deck-link import (v1.8)
- `public/sw.js`: service worker (offline cache). Bump `CACHE` when you deploy changes.
- `public/manifest.json`, `public/icons/`: PWA manifest + icons (180, 192, 512, maskable 512)
- `tools/test.mjs`: Playwright end-to-end test (iPhone 390x844; `tools/board.mjs` = seat geometry helpers for the game board). `tools/make-icons.mjs` regenerates the icons; `tools/shot-standalone.mjs` renders the game with emulated iPhone safe areas; `tools/fixture-v1.json` is v1.0-format data used to test backward compatibility.
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

## Life tap zones (v1.5.1)
- The round +/− buttons on the life panels are gone. Each panel is split into two tap zones in the player's own
  orientation (panels are rotated per seat): the half above the life number adds 1, the half below subtracts 1
  (the split follows the number's centre, including safe-area padding). Hold = ±10, repeating every 0.65 s while held.
- Hints: faint "+" / "−" glyphs at the left and right edges, just above / below the number's centre line (not buttons).
  Each tap briefly glows on that half; the running-change pill now sits beside the number so it never covers the name.
- The ⋯ button and status chips keep working on top of the zones; the name/commander text is click-through.
- Input: pointer events only (touchstart is prevented, so no extra click, no double-tap zoom), no text selection;
  zones have role="button" + labels and accept Enter/Space (Shift = ±10) for keyboard/switch access.
- Tests tap by coordinates computed from each seat's rotation (`halfPoint()` in `tools/test.mjs`) for 2–6 players on
  phone and iPad. `tools/shot-zones.mjs` renders `screenshots/36-game-tap-zones*.png` (`ALL=1` adds iPad / 2p / 3p).

## Centre timer (v1.5.2)
- The game timer inside the centre ring slowly turns (one full turn every 36 s, CSS transform animation on
  `.cb-spin`), so every seat can read it. Only the content turns; the 68 px button (tap = game menu) stays put.
- Every 20 s it cross-fades for 4 s to the time of day (HH:MM, 24-hour, device timezone) with a small cyan clock
  icon, then fades back to the game timer.
- Reduced motion (OS setting): no rotation and an instant swap. The animation pauses while the page is hidden.
- Settings → "Slowly rotate the centre timer" (on by default) turns the rotation off; the time-of-day swap stays.
- Tests shorten the cycle with `window.__edh.setCenterCycle(everyMs, showMs)`. `tools/shot-center.mjs` renders
  `screenshots/37-center-*.png` (full screen + zoomed crops, 4 players and 6 players on 375×667).

## Polish & testing (v1.6.0)
- Fixed: tapping a status chip (poison, commander damage, tax, Sol Ring) on iPhone Safari changed life instead of
  opening the player sheet. The chips are real buttons now, with spoken labels. After an update, WebKit could stay on
  the old version: the new service worker waits at most 3 s for `navigate()`, and the page also reloads itself when a
  newer worker takes over (game state is saved first). A draw now gives every survivor 1st place (they used to be
  ranked 1, 2, 3 by seat). A backup too big for the device used to say "Backup merged" and then vanish on reload; now
  it says so and nothing changes. The commander name is visible on 5–6 player middle panels. Toasts stay on one line.
  History renders 50 games at a time ("Show more"), so thousands of games stay fast. Form fields are paired with their labels.
- Polish: a one-time hint on the first game ("Tap +1 / Hold for ±10 / Tap −1", in every seat's orientation, never
  blocks taps; stored under its own key `edh-tracker:tapHint`, so the data format is unchanged). Sheets are modal dialogs
  (named, focused, Escape closes, focus returns). Every tappable control has the same press dip. The life-change pill pops in.
  Every stats card title has an icon. Commander/deck names share one left edge, with colours on the line below. End-game
  Sol Ring chips carry the seat colour. Player-sheet toggles stack the icon above the label. Empty Stats/History pages get a
  "Start a game" button. Group data shows a loading skeleton. On iPad the centre button and panel text are larger.
- Tests (all run under Chromium **and** WebKit: `ENGINE=webkit node tools/<suite>.mjs`, see `tools/engine.mjs`;
  WebKit is installed with `npx playwright-core install webkit` + `sudo npx playwright-core install-deps webkit`):
  - `test.mjs`: the main end-to-end suite, including the v1.6 regressions.
  - `test-games.mjs`: five scripted full games (2–6 players) ending by life, commander damage (partner), poison,
    concede and draw, with turn order changed and Sol Rings marked. It checks the saved records, History and Stats numbers exactly.
  - `test-stress.mjs`: 200 rapid taps, a 2-hour clock, 60 games (render time and frame gaps), a 1500-game import,
    a too-big import, accessibility names/dialogs/Escape, reduced motion, and the update path from v1.6.1 mid-game (served from the
    deploy repo history) plus a newer worker that can't navigate.
  - `test-online.mjs`: two users in a group, offline play then sync, deck edit/delete, an offline game delete that syncs later,
    and (v1.7) brackets through migration, deck editor, seat overrides, guests, sync, the offline queue and DB constraints.
- Known WebKit test limits: Playwright's WebKit offline emulation also blocks service-worker responses, so offline
  checks there use a real server shutdown (local) or a fetch wrapper (online). WebKit can't intercept requests from pages
  controlled by a service worker, so one online device runs with service workers blocked under WebKit.

## Wide game layout (v1.6.1)
- Every game now uses the wide (landscape) layout, also with the phone held upright. iOS Home Screen apps ignore the
  manifest `orientation`, so the app does it itself: in a portrait viewport the game layer (`#game.rot90`) is a fixed
  box sized to the screen with width and height swapped (`--app-h` × `--app-w`), turned 90° clockwise with a CSS transform.
  With the phone really in landscape the game is shown without the extra turn. Turning the phone mid-game switches between
  the two (the game state is untouched, an open player sheet turns with it). Stats, History, login and Settings don't change.
- Players sit along the two long sides: the top row is turned 180° (it faces the far long side), the bottom row is upright.
  Everything in a panel follows its seat: name, life, ⋯, chips, +/− hints and the first-game hint. From each seat, the half
  farther away from the player (so the half nearest the screen centre) adds 1 and the near half subtracts 1; hold = ±10.
- Layouts (wide board, seats clockwise from top-left): 2 players = one on each long side; 3 = one full-width seat on top,
  two below; 4 = 2×2; 5 = three on top, two wider seats below; 6 = 2×3. No seat faces a short end.
- Safe areas follow the turn: the board's edges use `--bt/--br/--bb/--bl`, which map to the screen's right/bottom/left/top
  insets when turned, so the notch, the iOS home bar and the 812-of-874 px standalone gap are respected.
- Player ⋯ sheets face their player (as before, now including the extra 90°). Shared screens (game menu, dice, End game,
  confirmations, Display info) stay upright on the phone, full width, so reading and typing work normally.
- Settings → Defaults → "Wide game layout on an upright phone" (on by default) turns it off and brings back the upright
  layout from v1.6.0. It is a per-device setting stored under its own key `edh-tracker:wideLayout` (`'0'` = off), so the
  saved data format is unchanged. Display info shows the current game layout.
- Tests: `tools/board.mjs` works out each seat's screen direction from the CSS transforms (panel → root) and gives tap
  points for the +/− halves in the player's own orientation; `test.mjs`, `test-games.mjs` and `test-stress.mjs` use it.
  `test.mjs` checks 2–6 players upright (402×812) and in landscape (874×402): layout, seat edges, ±1 taps per seat, the + half
  nearest the centre, name/⋯/hints following the seat, hold-to-repeat, first-game hint, centre timer, sheets, turning
  mid-game, the iOS standalone safe areas and the Settings switch. `tools/shot-wide.mjs` renders the `screenshots/39-*` images.
- Limits: the turn is emulated, so iOS itself stays in portrait (status bar, notifications and the keyboard stay upright;
  that's why shared sheets with text fields stay upright too). While a text field is focused the board isn't re-laid out
  (the keyboard resizes the viewport); it catches up on the next resize.

## Commander Brackets (v1.7.0)
- Official WotC Commander Brackets, 1–5: **1 Exhibition**, **2 Core**, **3 Upgraded**, **4 Optimized**, **5 cEDH**. Optional on every
  deck/commander (including guest commanders). Shown as a small coloured chip with the number and name.
- Where you set it: the commander / deck editor, the seat's Bracket button at game setup, the guest-commander form, and the
  in-game ⋯ sheet ("this game only"). Tapping the selected bracket clears it.
- Per-game snapshot: each player entry stores the bracket their deck had when the game started. Editing a deck later does not
  change past games. At setup, your own deck's bracket is saved on the deck (online: `cloud.saveDeck`); someone else's deck
  uses a per-seat override for the next game only; a guest's bracket lives on the guest commander.
- History: when every player has the same bracket it shows e.g. `B3 Upgraded`; mixed pods show a range like `B2–4`; partial
  pods (some unset) show e.g. `B3 Upgraded 2/3`. Older games simply have no bracket.
- Stats → **Brackets** card: games / win rate by bracket (per player and per commander), highest / lowest bracket at the table
  (mixed-bracket games where every player had one), and a Bracket filter on the existing turn-position card. Games without a
  bracket are excluded; a small note says so, as with the turn-position stats.
- Data: additive. Local `commanders[].bracket` and `games[].players[].bracket` (null / missing = unset). `normBracket` accepts
  1–5 (including numeric strings) and drops anything else. Data version stays 1; backups and the offline queue carry brackets.
- Online (Supabase): migration `commander_brackets` adds `decks.bracket` (1–5 or null), `games.bracket_min` / `bracket_max`
  (both null, or 1 ≤ min ≤ max ≤ 5), and a JSON check that `games.players[*].bracket` is missing, null or 1–5. RLS is unchanged;
  only the deck owner can change a deck's bracket. Sync, the offline queue and backups round-trip brackets. An older client that
  never sends brackets still inserts and loads fine.
- Tools: `tools/seed-v17.mjs` (bracketed seed), `tools/shot-v17.mjs` (40-* screenshots), `tools/game-fixture.mjs` (shared fixture).
  Stress updates from the live v1.6.1 commit mid-game.
- Limits: only the deck owner can change a deck's bracket (others use a per-game override); a guest's bracket is remembered from
  their game history; pod stats ignore partial pods; a live 1.6.1 client ignores brackets (its saves keep the deck bracket but
  its games have none).

## Deck-link import (v1.8.0): "Import from link"
- Paste an **Archidekt** or **Moxfield** deck link, and the app reads the deck's commander(s): names (partners and a
  Background as the second commander), colour identity, the deck name and the deck's bracket when the site has one. A
  preview shows e.g. `Found: Pako, Arcane Retriever + Haldan, Avid Arcanist · UG`. It fills the form, and nothing is saved until you
  tap Save. Pasting a link runs the import right away; Enter or **Find** also runs it.
- Where it works: the commander editor (local), the commander picker at game setup ("Import from Archidekt / Moxfield", or
  paste a link into the search box), the group deck editor and member deck picker (online; the deck name becomes the
  nickname), and the guest-commander form.
- Duplicates: if the commander (or partner pair) is already in the list or the group, the preview offers **Update it**
  (bracket, colours, link) or **Add as new**. If you didn't choose, a dialog asks at save time.
- Accepted links: `archidekt.com/decks/<id>[/<slug>]` and `moxfield.com/decks/<publicId>`, with or without `www`/`https`,
  with query strings or fragments, API URLs, or text around the link. Other sites say "Only Archidekt and Moxfield links are
  supported". A malformed id gets a "doesn't look like a deck link" message.
- **Text / typed fallback** (no proxy): paste a text export with a `Commander` section, `[Commander]` tags, `*CMDR*` or
  `# !Commander`, or just type one or two names (`Tymna + Thrasios`). Names are resolved through Scryfall's public
  `cards/named?fuzzy=` endpoint, which allows CORS; ambiguous or unknown names show a message.
- The **99 are never stored**. Only the commander names, colours, the bracket and the canonical deck link (`decks.link` /
  `commanders[].link`) are kept. The editor shows "Imported from Archidekt/Moxfield ↗". Re-importing in the same form
  replaces the link and any previously imported bracket.
- Brackets: Archidekt's `edhBracket` is set by the deck owner. For Moxfield, when the bracket equals Moxfield's automatic
  estimate (`autoBracket`) it is labelled **estimated**. Decks with brackets ignored import without one.
- **Proxy**: neither site sends CORS headers for github.io, so the app calls the Supabase Edge Function `deck-commanders`
  (`supabase/functions/deck-commanders/index.ts`, `verify_jwt` off, no secrets, no database access):
  `GET /functions/v1/deck-commanders?source=archidekt|moxfield&id=<id>`. It strictly validates the id (Archidekt `^\d{1,10}$`,
  Moxfield `^[A-Za-z0-9_-]{8,32}$`; anything else is 400) and only ever fetches `archidekt.com/api/decks/<id>/` or
  `api2.moxfield.com/v3/decks/all/<id>`, so it can't be used as an open proxy. It returns only
  `{source,id,url,name,commanders[{name,colors}],colors,bracket,bracketAuto,extra}` (at most 2 commanders; `extra` counts any further ones). CORS is limited to `https://creepyfoxx.github.io` and
  localhost. It uses an 8 s upstream timeout, an identifying User-Agent, about 30 requests/min per IP, and a 10-minute cache of successful reads. Errors:
  `not_found` 404, `private` 403, `no_commander` 422, `busy` 429, `blocked` 502 (the site's firewall refused), `timeout` 504.
  The app turns these into plain messages. Offline, it says "Needs internet to import."
- **Limitations**
  - Archidekt's firewall (Google Cloud Armor) refuses a share of requests from cloud servers, roughly 1 in 3 in testing. The
    app then says Archidekt blocked the request, suggests trying again in a minute or pasting the deck's text export, and doesn't
    retry automatically: bot protection is never bypassed.
  - Moxfield has worked reliably through the proxy. Both are unofficial APIs and can change.
  - A private deck usually looks like "not found" (both sites return 404 for them). Maybeboard and sideboard commanders are ignored.
- Online (Supabase): migration `deck_import_link` adds nullable `decks.link` with a check that only allows canonical
  Archidekt/Moxfield deck URLs. RLS is unchanged. Older clients ignore the column, and saving a deck without importing keeps its link.
- Tools: `public/import.js` (`window.EDHImport`: link/text parsing, proxy + Scryfall calls, messages), `tools/import-mock.mjs`
  (proxy + Scryfall fixtures for the offline suites), `tools/test-import-live.mjs` (live proxy and real decks; `URL=`/`ENGINE=`),
  `tools/shot-v18.mjs` (41-* screenshots). Stress now updates from the live v1.7.0 commit mid-game.

## Seat preview (v1.9.0)
- **New game → Seats** now starts with a small **table preview**: every seat where the game board will put it, with the seat
  number and colour, the player's name (or the "Player N" placeholder), the commander with its colour pips, a glowing bar on
  the edge that player sits at, and a "clockwise" marker in the middle (seats go clockwise from seat 1, which is also the turn
  order). Labels say which side is **Top · far side** and which is **Bottom · near side**.
- **First player**: with *Random first player* off, seat 1 is marked **1st** (the game assumes seat 1 unless you pick someone);
  with it on, nobody is marked and the note says the first player is picked at random after Start.
- **Rearrange**: tap a seat (it glows, the others get a dashed outline), then tap another seat to swap the two players. Tap
  the selected seat again to cancel. A swap moves everything that belongs to the seat: name and commander (local), or member +
  deck, guest + commander and any per-seat bracket override (playgroup). The seat list below follows, the order is saved at
  once, and the game is created in that order, so `seat`, `firstPlayerIndex` / `first_player_index`, `turnPos`, `wentFirst`,
  `winnerIndex` and `killedBy` all follow the new positions. Dragging isn't supported; taps are.
- **Same code as the game**: the preview uses `boardMode()` and the same `WIDE_LAYOUTS` / `TALL_LAYOUTS` grid areas and seat
  rotations as `renderGame()`. Upright phone with the wide layout (default): drawn in the board's own frame, i.e. how the game
  looks with the phone on its side, top end to the left (3 players: 1 on top, 2 below; 5: 3 on top, 2 below; 6: 2×3).
  Landscape phone / iPad: the wide layout as on screen. Wide layout switched off: the upright layout (seats on the long
  left/right edges). It redraws on rotation / resize, when names are typed, and when the player count changes.
- **During a game**: game menu → **Rearrange seats** shows the same table for the current game, with the first player
  (if one was picked) marked 1st and everyone's turn position. Tap two seats to swap them. Player ids stay the same, so life,
  commander damage, poison, tax, Monarch / Initiative, Sol Ring, brackets, the first player and the timer all stay with the
  person; seat numbers / colours follow the position (as if the game had started in that order). The setup is updated too,
  so **Rematch** uses the corrected order. Reloading mid-game keeps it.
- **Data**: no new fields and no migration. Setup seat order lives where it already did (`lastSetup.seats` /
  `groupSetups[groupId]`); saved games, backups, the offline queue and Supabase rows look exactly like games started in that order.
- Tests: `test.mjs` checks the preview against the real board for 2–6 players on an upright iPhone (wide + wide off), an
  iPhone in landscape, and an iPad in portrait / landscape (position, sitting edge and name per seat, 1/2, 2/2, 3/2, 3/3 rows),
  tap-to-swap, cancel, live updates, the first-player marker, the in-game swap (state kept, first player and turn order, board
  re-laid out, reload, saved record, Rematch) and a v1.8 game in progress. `test-online.mjs` swaps group seats (bracket
  override moves along) and checks the uploaded row after a setup + mid-game swap. `test-stress.mjs` updates from the live
  v1.8.0 commit mid-game and rearranges that game. `tools/shot-v19.mjs` renders `screenshots/42-*`.
- Limits: the preview's text is always drawn upright for the person holding the phone (in the game the top row is upside
  down for them); the bar on each seat shows which edge that player sits at. No drag and drop.
