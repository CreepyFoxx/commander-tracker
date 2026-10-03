/* Commander Tracker — life, commander damage & stats for MTG Commander. Plain JS, no dependencies. */
'use strict';
(function () {
  const STORE_KEY = 'edh-tracker:v1';
  const APP_VERSION = '1.9.0';
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];
  const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
  const REASON = { life: 'life total', commander: 'commander damage', poison: 'poison', conceded: 'conceded' };
  const LIFE_PRESETS = [20, 25, 30, 40];
  // [row, col, colSpan, rotation] per seat, seats listed clockwise around the table.
  // TALL: an upright screen with the wide layout switched off (players along the long left/right edges).
  const TALL_LAYOUTS = {
    2: { rows: 2, cols: 1, seats: [[1, 1, 1, 180], [2, 1, 1, 0]] },
    3: { rows: 2, cols: 2, seats: [[1, 1, 2, 180], [2, 2, 1, -90], [2, 1, 1, 90]] },
    4: { rows: 2, cols: 2, seats: [[1, 1, 1, 90], [1, 2, 1, -90], [2, 2, 1, -90], [2, 1, 1, 90]] },
    5: { rows: 3, cols: 2, seats: [[1, 1, 2, 180], [2, 2, 1, -90], [3, 2, 1, -90], [3, 1, 1, 90], [2, 1, 1, 90]] },
    6: { rows: 3, cols: 2, seats: [[1, 1, 1, 90], [1, 2, 1, -90], [2, 2, 1, -90], [3, 2, 1, -90], [3, 1, 1, 90], [2, 1, 1, 90]] },
  };
  // WIDE (v1.6.1): a landscape screen, or an upright phone showing the game turned 90°. Players sit along the two long
  // sides: the top row faces the top edge (180°), the bottom row the bottom edge (0°). 5 players = 3 on top, 2 below.
  const WIDE_LAYOUTS = {
    2: { rows: 2, cols: 1, seats: [[1, 1, 1, 180], [2, 1, 1, 0]] },
    3: { rows: 2, cols: 2, seats: [[1, 1, 2, 180], [2, 2, 1, 0], [2, 1, 1, 0]] },
    4: { rows: 2, cols: 2, seats: [[1, 1, 1, 180], [1, 2, 1, 180], [2, 2, 1, 0], [2, 1, 1, 0]] },
    5: { rows: 2, cols: 6, seats: [[1, 1, 2, 180], [1, 3, 2, 180], [1, 5, 2, 180], [2, 4, 3, 0], [2, 1, 3, 0]] },
    6: { rows: 2, cols: 3, seats: [[1, 1, 1, 180], [1, 2, 1, 180], [1, 3, 1, 180], [2, 3, 1, 0], [2, 2, 1, 0], [2, 1, 1, 0]] },
  };
  const I = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    sword: '<svg viewBox="0 0 24 24" class="ico-sword"><path d="M14.5 3.5H20.5V9.5L9 21 3 15z" /><path d="M6 12l6 6M4 20l2-2"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4M12 13v4M8 20h8M9.5 17h5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg>',
    d6: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.6" cy="8.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.6" cy="15.4" r="1.2" fill="currentColor" stroke="none"/></svg>',
    d20: '<svg viewBox="0 0 24 24"><path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 7.5 7.4 15h9.2zM12 2.8v4.7M4 7.4l3.4 7.6M20 7.4 16.6 15M7.4 15 12 21.2 16.6 15"/></svg>',
    coin: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8.5" ry="8.5"/><path d="M12 7.5v9M14.6 9.3c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5.2 1.4 5.2 4 0 1.1-1.2 1.9-2.7 1.9-1.1 0-2.1-.5-2.7-1.3"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M3.5 8 7.8 12 12 5l4.2 7 4.3-4-1.8 10.5H5.3z"/><path d="M5.8 21h12.4"/></svg>',
    castle: '<svg viewBox="0 0 24 24"><path d="M4 21V9h3v2h2.5V8.5h5V11H17V9h3v12zM10 21v-4a2 2 0 0 1 4 0v4M12 8.5V3l4 1.6-4 1.6"/></svg>',
    poison: '<svg viewBox="0 0 24 24"><path d="M12 3.2s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z"/><path d="M9.5 14.5a2.7 2.7 0 0 0 2.5 2.4"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 3.2 4 6.9 4c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.7 0 6 3.8 4.5 7.2-2.1 4.7-9.6 9.3-9.6 9.3z"/></svg>',
    cycle: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.7.8 2.7 2.6 3 5.2"/></svg>',
    turns: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7"/><path d="M12 8v4.2l2.8 1.7"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24"><path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5.5 9 9s-9 4-9 9M16.5 3c0 5-9 5.5-9 9s9 4 9 9"/></svg>',
    first: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4.5c4-2.5 7 2.5 13 0v9c-6 2.5-9-2.5-13 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/><path d="M9 11.5l2 2 4-4"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    history: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    skull: '<svg viewBox="0 0 24 24"><path d="M12 3C7.6 3 4.5 6.1 4.5 10.2c0 2.4 1.1 4.2 2.8 5.3V19a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1v-3.5c1.7-1.1 2.8-2.9 2.8-5.3C19.5 6.1 16.4 3 12 3z"/><circle cx="9.2" cy="11" r="1.6" fill="currentColor"/><circle cx="14.8" cy="11" r="1.6" fill="currentColor"/><path d="M10.5 20v-2.5M13.5 20v-2.5"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4.5c4-2.5 7 2.5 13 0v9c-6 2.5-9-2.5-13 0"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    hand: '<svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10V4.5a1.5 1.5 0 0 1 3 0V11M15 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.6 7-6.5 7-2.6 0-4.2-1.3-5.6-3.4L3.8 13.6a1.6 1.6 0 0 1 2.6-1.8L9 14.5V8a1.5 1.5 0 0 1 3 0"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10" cy="7.5" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>',
    bracket: '<svg viewBox="0 0 24 24"><path d="M3.5 17.5a8.5 8.5 0 0 1 17 0"/><path d="M12 17.5l4.3-5.3"/><circle cx="12" cy="17.5" r="1.5"/><path d="M5.9 11.4l1.4 1.1M12 8.9v1.8M18.1 11.4l-1.4 1.1"/></svg>',
    link: '<svg viewBox="0 0 24 24" class="ico-link"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6"/></svg>',
    cw: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M18.3 2.8l-.6 4.3-4.3-.6"/></svg>',
    seats: '<svg viewBox="0 0 24 24"><rect x="6.5" y="8" width="11" height="8" rx="2"/><circle cx="9" cy="4.3" r="1.6"/><circle cx="15" cy="4.3" r="1.6"/><circle cx="9" cy="19.7" r="1.6"/><circle cx="15" cy="19.7" r="1.6"/></svg>',
    solring: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14.5" rx="8" ry="5.8"/><ellipse cx="12" cy="14.5" rx="4.2" ry="2.6"/><path d="M12 3.2l2.3 3.1L12 8.7 9.7 6.3z"/></svg>',
  };
  // commander colour identity as a CSS gradient (deck accent strips, commander bars)
  const MANA_HEX = { W: '#f6efd2', U: '#3f8fe6', B: '#a594ad', R: '#ee5a40', G: '#2fb266', C: '#b8bbc9' };
  function manaGrad(colors, dir = '180deg') {
    const cs = colors && colors.length ? colors : ['C'];
    if (cs.length === 1) return `linear-gradient(${dir}, ${MANA_HEX[cs[0]]}, ${MANA_HEX[cs[0]]})`;
    return `linear-gradient(${dir}, ${cs.map((c, i) => `${MANA_HEX[c]} ${Math.round((i / (cs.length - 1)) * 100)}%`).join(', ')})`;
  }

  // ---------- Commander Brackets (v1.7, WotC 1-5 scale) ----------
  const BR_NAME = ['', 'Exhibition', 'Core', 'Upgraded', 'Optimized', 'cEDH'];
  const BR_DESC = ['', 'Ultra-casual: theme and story over power.', 'Precon level: no Game Changers, mass land denial, extra-turn chains or 2-card combos.',
    'Stronger decks: up to three Game Changers, no mass land denial or early 2-card combos.', 'High power: anything legal goes.', 'Competitive: tuned to win the cEDH metagame.'];
  // 1..5, anything else (missing, null, 0, 6, 2.5, "x") = not set
  const normBracket = (b) => { if (b == null || b === '' || typeof b === 'boolean') return null; const n = Number(b); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
  // v1.8: canonical Archidekt / Moxfield deck URL a commander was imported from (same shape the database accepts)
  const LINK_RE = /^https:\/\/(archidekt\.com\/decks\/[0-9]{1,10}|moxfield\.com\/decks\/[A-Za-z0-9_-]{8,32})$/;
  function cleanLink(u) { return typeof u === 'string' && LINK_RE.test(u) ? u : ''; }
  const linkSite = (u) => (/archidekt\.com/.test(u) ? 'Archidekt' : 'Moxfield');
  // small chip: number + name (the name hides on narrow panels via CSS)
  function bchip(b, cls = '') {
    b = normBracket(b); if (!b) return '';
    return `<span class="bchip b${b} ${cls}" role="img" aria-label="Bracket ${b}, ${BR_NAME[b]}" title="Bracket ${b} · ${BR_NAME[b]}"><b>${b}</b><span class="bn">${BR_NAME[b]}</span></span>`;
  }
  const brBadge = (b) => (normBracket(b) ? `<span class="br-badge b${b}" role="img" aria-label="Bracket ${b}, ${BR_NAME[b]}" title="Bracket ${b} · ${BR_NAME[b]}">B${b}</span>` : '');
  // the pod's brackets: lowest / highest among players that have one; all = every player has one
  function podBracket(players) {
    const bs = players.map((p) => normBracket(p.bracket)); const known = bs.filter(Boolean);
    if (!known.length) return null;
    return { lo: Math.min(...known), hi: Math.max(...known), all: known.length === bs.length, known: known.length, n: bs.length };
  }
  const podLabel = (pb) => (pb.lo === pb.hi ? `B${pb.lo}` : `B${pb.lo}–${pb.hi}`);
  const brDescHtml = (b) => (b ? `<b>${b} · ${BR_NAME[b]}</b> — ${BR_DESC[b]}` : 'Not set. Tap a bracket (tap it again to clear).');
  // picker: 5 buttons (tap the selected one again = unset)
  function bracketPicker(cur, opts = {}) {
    cur = normBracket(cur);
    return `<div class="bracket-pick" role="radiogroup" aria-label="${esc(opts.label || 'Commander Bracket')}">${[1, 2, 3, 4, 5].map((b) => `<button type="button" class="bp b${b} ${cur === b ? 'on' : ''}" data-bracket="${b}" role="radio" aria-checked="${cur === b}" aria-label="Bracket ${b}: ${BR_NAME[b]}"><b>${b}</b><small>${BR_NAME[b]}</small></button>`).join('')}</div>
      ${opts.desc === false ? '' : `<div class="bp-desc" data-role="bdesc">${brDescHtml(cur)}</div>`}`;
  }
  // wires a picker inside root; get() -> current value, set(v) is called with the new value (null = unset)
  function bindBracketPicker(root, get, set) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bracket]'); if (!b || !root.contains(b)) return;
      const v = +b.dataset.bracket; const nv = get() === v ? null : v;
      if (set(nv) === false) return;
      paintBracketPicker(root, nv);
    });
  }
  function paintBracketPicker(root, v) {
    root.querySelectorAll('[data-bracket]').forEach((x) => { const on = +x.dataset.bracket === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    const d = root.querySelector('[data-role=bdesc]'); if (d) d.innerHTML = brDescHtml(v);
  }

  // ---------- store ----------
  function defaults() {
    return {
      version: 1, commanders: [], games: [],
      settings: { startingLife: 40, playerCount: 4, wakeLock: true, randomFirst: true, spinClock: true },
      lastSetup: null, current: null,
    };
  }
  function sanitizeCommander(c) {
    const out = {
      id: String(c.id || uid()), name: String(c.name || 'Unnamed').slice(0, 80),
      partner: String(c.partner || '').slice(0, 80),
      colors: WUBRG.filter((x) => Array.isArray(c.colors) && c.colors.includes(x)),
      owner: String(c.owner || '').slice(0, 40), createdAt: +c.createdAt || Date.now(),
      bracket: normBracket(c.bracket), // v1.7 (null = not set; older data has none)
    };
    const link = cleanLink(c.link); if (link) out.link = link; // v1.8, optional: only present on imported commanders
    return out;
  }
  function normalize(d) {
    const out = Object.assign(defaults(), d || {});
    out.settings = Object.assign(defaults().settings, (d && d.settings) || {});
    out.commanders = Array.isArray(out.commanders) ? out.commanders.map(sanitizeCommander) : [];
    out.games = Array.isArray(out.games) ? out.games.filter((g) => g && Array.isArray(g.players)) : [];
    // v1.7: per-player bracket snapshots are optional; drop invalid values (older games simply have none)
    out.games.forEach((g) => g.players.forEach((p) => { if (p && 'bracket' in p) p.bracket = normBracket(p.bracket); }));
    if (out.current && !Array.isArray(out.current.players)) out.current = null;
    return out;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaults();
    } catch (e) { console.warn('load failed', e); return defaults(); }
  }
  let data = load();
  let saveTimer = null;
  const persist = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } };
  function save(now) {
    clearTimeout(saveTimer);
    const run = () => { const ok = persist(); if (!ok) toast('Could not save — storage full?'); return ok; };
    if (now) return run();
    saveTimer = setTimeout(run, 200); return true;
  }
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); else requestWakeLock(); });

  // ---------- utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function rand(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  function fmtDur(ms) {
    const m = Math.round((ms || 0) / 60000);
    return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  }
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const pct = (w, g) => (g ? Math.round((w / g) * 100) + '%' : '—');
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  // Turn order (v1.5): seats are listed clockwise and play passes clockwise, so a seat's position is its distance from the
  // first player + 1. Returns [position of seat 0, position of seat 1, ...] (1..n).
  const turnPositions = (n, first) => Array.from({ length: n }, (_, i) => ((i - first + n) % n) + 1);
  const hasTurnPos = (g) => g.players.every((p) => Number.isInteger(p.turnPos) && p.turnPos >= 1 && p.turnPos <= g.players.length);
  const hasSolRing = (g) => g.players.every((p) => typeof p.solRingT1 === 'boolean');
  function pips(colors) {
    if (!colors || !colors.length) return '<span class="pip pip-C"></span>';
    return colors.map((c) => `<span class="pip pip-${c}"></span>`).join('');
  }
  const colorWords = (colors) => (colors && colors.length ? colors.map((x) => COLOR_NAME[x]).join(', ') : 'Colorless');
  const cmdLabel = (c) => (c.partner ? `${c.name} + ${c.partner}` : c.name);
  const getCmd = (id) => (id ? data.commanders.find((c) => c.id === id) : null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function knownPlayers() {
    const freq = new Map();
    const add = (n, w) => { n = (n || '').trim(); if (!n) return; const k = n.toLowerCase(); const e = freq.get(k) || { n, c: 0 }; e.c += w; freq.set(k, e); };
    data.games.forEach((g) => g.players.forEach((p) => add(p.name, 2)));
    data.commanders.forEach((c) => add(c.owner, 1));
    return [...freq.values()].sort((a, b) => b.c - a.c).map((e) => e.n);
  }

  // ---------- overlays ----------
  let fieldSeq = 0;
  function linkLabels(root) {
    root.querySelectorAll('.field > label:not([for])').forEach((l) => {
      const c = l.parentElement.querySelector('input:not([type=checkbox]):not([type=hidden]), select, textarea'); if (!c || c.getAttribute('aria-label')) return;
      if (!c.id) c.id = 'fld-' + ++fieldSeq; l.htmlFor = c.id;
    });
  }
  const labelObs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.querySelector) linkLabels(n); })));
  ['#view', '#overlay-root', '#login'].forEach((sel) => { const el = document.querySelector(sel); if (el) { labelObs.observe(el, { childList: true, subtree: true }); linkLabels(el); } });
  let lastTrigger = null; // the control that opened a sheet (Safari doesn't focus buttons on tap), focus goes back there
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button, [role=button], a'); if (b && !b.closest('.overlay')) lastTrigger = b; }, true);
  let sheetSeq = 0;
  function openSheet(html, opts = {}) {
    const ov = document.createElement('div');
    const rot = opts.rot || 0;
    ov.className = 'overlay' + (opts.dialog ? ' is-dialog' : '');
    ov.innerHTML = `<div class="backdrop"></div><div class="rot-frame ${Math.abs(rot) === 90 ? 'side' : ''}" style="--rot:${rot}deg"><div class="sheet ${opts.cls || ''}" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
    const sheet = ov.querySelector('.sheet'); const title = sheet.querySelector('h2, .dialog-body > p, .dialog-body > .muted');
    if (title) { title.id = title.id || 'sheet-t' + ++sheetSeq; sheet.setAttribute('aria-labelledby', title.id); }
    const active = document.activeElement;
    ov._returnFocus = active && active !== document.body && !active.closest('.overlay') ? active : lastTrigger;
    $('#overlay-root').appendChild(ov);
    try { sheet.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    ov.addEventListener('click', (e) => {
      if (e.target.classList.contains('backdrop') || e.target.closest('[data-close]')) closeOverlay(ov);
    });
    ov._onClose = opts.onClose;
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('open')));
    return ov;
  }
  function closeOverlay(ov) {
    if (!ov || ov._closing) return; ov._closing = true;
    ov.classList.remove('open');
    if (ov._onClose) ov._onClose();
    const rf = ov._returnFocus; const top = $$('.overlay').filter((o) => o !== ov && !o._closing).pop();
    if (top) { const s = top.querySelector('.sheet'); if (s && !s.contains(document.activeElement)) s.focus({ preventScroll: true }); }
    else if (rf && document.contains(rf) && rf.offsetParent !== null) rf.focus({ preventScroll: true });
    setTimeout(() => { ov.remove(); if (renderQueued && !$('.overlay')) requestRender(); }, 220);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return; const top = $$('.overlay').filter((o) => !o._closing).pop();
    if (top) { e.preventDefault(); closeOverlay(top); }
  });
  function alertDialog(message, label = 'OK') {
    return new Promise((resolve) => openSheet(`<div class="dialog-body"><p>${message}</p><div class="dialog-actions"><button class="btn primary" data-close>${esc(label)}</button></div></div>`, { dialog: true, onClose: resolve }));
  }
  function refreshOverlays() { $$('.overlay').forEach((ov) => ov._refresh && !ov._closing && ov._refresh()); }
  function choiceDialog(message, choices, opts = {}) {
    return new Promise((resolve) => {
      let result = null;
      const ov = openSheet(`<div class="dialog-body"><p>${message}</p><div class="dialog-actions">${choices.map((c, i) => `<button class="btn ${c.cls || ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}<button class="btn ghost" data-close>Cancel</button></div></div>`,
        { dialog: true, rot: opts.rot, onClose: () => resolve(result) });
      ov.querySelector('.dialog-actions').addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]'); if (!b) return; result = choices[+b.dataset.i].value; closeOverlay(ov);
      });
    });
  }
  const confirmDialog = (message, label = 'OK', danger = false, rot = 0) =>
    choiceDialog(message, [{ label, value: true, cls: danger ? 'danger' : 'primary' }], { rot }).then((v) => v === true);

  // ---------- navigation ----------
  let tab = 'play';
  let cmdSort = 'games';
  let statsScope = 'group';
  let posSize = null; let posBy = 'players'; let solBy = 'players'; // v1.5 stats view state (null = most common pod size)
  let posBr = 'any'; let brBy = 'players'; // v1.7: turn-position bracket filter, Brackets card table
  function renderTab() {
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const v = $('#view'); v.dataset.tab = tab;
    ({ play: renderPlay, commanders: renderCommanders, stats: renderStats, history: renderHistory, settings: renderSettings })[tab](v);
  }
  function setTab(t) {
    tab = t; histLimit = 50; tpSel = null; renderTab(); window.scrollTo(0, 0);
    const v = $('#view'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); // gentle view-in (disabled under reduced motion)
  }

  // ---------- setup ----------
  function getSetup() {
    if (!data.lastSetup) data.lastSetup = { count: data.settings.playerCount, life: data.settings.startingLife, seats: [] };
    const s = data.lastSetup;
    while (s.seats.length < 6) s.seats.push({ name: '', commanderId: null });
    return s;
  }
  function installHint() {
    if (isStandalone()) return '';
    return `<div class="card hint-card"><b>Install on your iPhone or iPad</b><p>Open this page in Safari, tap <b>Share</b> <span class="share-ico">⬆︎</span> then <b>Add to Home Screen</b>. It runs full-screen and offline. Your data lives only on this device — use Settings → Export to back it up.</p></div>`;
  }
  function renderPlay(v) {
    if (gm()) { renderGroupPlay(v); return; }
    const s = getSetup(); const g = data.current;
    const promo = !cloud ? '' : !me() ? `<div class="card promo"><div><b>Play with your group</b><div class="muted small">Sign in to load your friends' decks and share games & stats.</div></div><button class="btn sm" data-act="authSignin">Sign in</button></div>`
      : `<div class="card promo"><div><b>Signed in as ${esc(me().display_name)}</b><div class="muted small">Create or join a playgroup to share games.</div></div><button class="btn sm" data-act="goSettings">Playgroup</button></div>`;
    v.innerHTML = `
    <header class="page-head"><div><div class="eyebrow">Commander Tracker</div><h1>New game</h1></div></header>
    ${g ? '' : promo}
    ${g ? `<div class="card resume"><div><b>Game in progress</b><div class="muted small">${g.players.length} players · started ${fmtTime(g.startedAt)}</div></div>
      <div class="row"><button class="btn ghost sm" data-act="discardGame">Discard</button><button class="btn primary sm" data-act="resumeGame">Resume</button></div></div>` : ''}
    <section class="card">
      <div class="field"><label>Players</label><div class="seg">${[2, 3, 4, 5, 6].map((n) => `<button data-act="setCount" data-v="${n}" class="${s.count === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Starting life</label><div class="seg" id="life-seg">${LIFE_PRESETS.map((n) => `<button data-act="setLife" data-v="${n}" class="${s.life === n ? 'on' : ''}">${n}</button>`).join('')}
        <input class="seg-input ${LIFE_PRESETS.includes(s.life) ? '' : 'on'}" type="number" inputmode="numeric" min="1" max="999" placeholder="Other" aria-label="Other starting life" value="${LIFE_PRESETS.includes(s.life) ? '' : s.life}" data-bind="customLife"></div></div>
      <label class="switch-row"><span>Random first player</span><input type="checkbox" data-bind="randomFirst" ${data.settings.randomFirst ? 'checked' : ''}><i class="switch"></i></label>
    </section>
    <section class="card">
      <div class="card-title">Seats <span class="muted small">clockwise around the table</span></div>
      ${setupPreviewHtml()}
      ${s.seats.slice(0, s.count).map((seat, i) => {
        const c = getCmd(seat.commanderId);
        return `<div class="seat-row">
          <span class="seat-dot seat-${i}">${i + 1}</span>
          <div class="seat-fields">
            <input type="text" list="player-names" placeholder="Player ${i + 1}" aria-label="Player ${i + 1} name" value="${esc(seat.name)}" data-bind="seatName" data-i="${i}" autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="24">
            <div class="cmd-line"><button class="cmd-pick ${c ? '' : 'empty'}" data-act="pickCmd" data-i="${i}">${c ? `<span class="pips">${pips(c.colors)}</span><span class="ellipsis">${esc(cmdLabel(c))}</span>` : '<span>Choose commander…</span>'}</button>
              ${c ? seatBrBtn(i, c.bracket, cmdLabel(c)) : ''}</div>
          </div></div>`;
      }).join('')}
      <datalist id="player-names">${knownPlayers().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </section>
    <button class="btn primary big block start-btn" data-act="startGame">${I.play}Start game</button>
    ${installHint()}`;
  }

  // ---------- v1.9: table preview (seat positions exactly as the game board lays them out) ----------
  // Uses the same boardMode() + WIDE_LAYOUTS / TALL_LAYOUTS as renderGame(), so the picture always matches the game.
  // Tap a seat, then another, to swap them (setup: the seats themselves; in game: the players, state kept).
  let tpSel = null; // selected seat index in the preview (null = none)
  const SIT_EDGE = { 0: 'b', 180: 't', 90: 'l', '-90': 'r' }; // where a seat's player sits (panel bottom after rotation)
  function previewSpec(n) {
    const M = boardMode(); const L = (M.wide ? WIDE_LAYOUTS : TALL_LAYOUTS)[n];
    const w = M.rot === 90 ? innerHeight : innerWidth, h = M.rot === 90 ? innerWidth : innerHeight;
    const ar = Math.round((M.wide ? Math.min(2.2, Math.max(1.35, w / h)) : Math.min(0.75, Math.max(0.6, w / h))) * 1000) / 1000;
    const caption = M.key === 'wide90' ? 'Phone on its side, top end to the left' : M.key === 'wide' ? 'As on the game screen' : 'Phone upright';
    return { M, L, ar, caption };
  }
  // seats: [{ name, ph (placeholder), cmd, colors, guest }], opts: { sel, first (index | -1), ords (show 1st..Nth), note }
  function tablePreviewHtml(seats, opts = {}) {
    const n = seats.length; const { M, L, ar, caption } = previewSpec(n);
    const first = opts.first == null ? -1 : opts.first; const pos = first >= 0 ? turnPositions(n, first) : null;
    const side = (rot) => ({ t: 'top', b: 'bottom', l: 'left', r: 'right' }[SIT_EDGE[rot]]);
    const cells = seats.map((s, i) => {
      const [r, c, span, rot] = L.seats[i]; const sel = opts.sel === i;
      const k = pos ? pos[i] : 0; const isFirst = k === 1;
      const nm = s.name || s.ph;
      return `<button type="button" class="tp-seat seat-${i} sit-${SIT_EDGE[rot]} ${sel ? 'sel' : ''} ${opts.sel != null && !sel ? 'target' : ''}" style="grid-area:${r}/${c}/span 1/span ${span}" data-tp="${i}" data-rot="${rot}" aria-pressed="${sel}"
        aria-label="Seat ${i + 1}, ${esc(nm)}${s.cmd ? ', ' + esc(s.cmd) : ''}, ${side(rot)} side${isFirst ? ', goes first' : k ? `, ${ordinal(k)} to play` : ''}. ${sel ? 'Selected: tap another seat to swap, or tap again to cancel.' : opts.sel != null ? `Tap to swap with seat ${opts.sel + 1}.` : 'Tap, then tap another seat to swap.'}">
        <span class="tp-in"><span class="tp-top"><span class="seat-dot tp-dot">${i + 1}</span><b class="tp-name ellipsis ${s.name ? '' : 'ph'}">${esc(nm)}</b>${isFirst ? `<span class="tp-first">${I.first}<span>1st</span></span>` : k && opts.ords ? `<span class="tp-ord">${ordinal(k)}</span>` : ''}</span>
        <span class="tp-cmd">${s.cmd ? `<span class="pips">${pips(s.colors || [])}</span><span class="ellipsis">${esc(s.cmd)}</span>` : `<span class="ellipsis ph">${s.guest ? 'Guest' : 'No commander'}</span>`}</span></span></button>`;
    }).join('');
    const sideLbl = (t, cls) => `<div class="tp-side ${cls}">${t}</div>`;
    const status = opts.sel != null ? `Seat ${opts.sel + 1} selected — now tap where they go` : 'Tap a seat, then another, to swap them';
    return `<div class="tp" data-layout="${M.key}" data-n="${n}">
      ${M.wide ? sideLbl(`${I.up}<span><b>Top</b> · far side</span>`, 'tp-far') : sideLbl('<span><b>Top</b> of the phone</span>', 'tp-far')}
      <div class="tp-table ${M.wide ? 'wide' : 'tall'}" style="--ar:${ar};grid-template-rows:repeat(${L.rows},1fr);grid-template-columns:repeat(${L.cols},1fr)" role="group" aria-label="Table preview, seats clockwise from seat 1">
        ${cells}<span class="tp-center" aria-hidden="true" title="clockwise">${I.cw}<small>clockwise</small></span></div>
      ${M.wide ? sideLbl(`${I.down}<span><b>Bottom</b> · near side</span>`, 'tp-near') : sideLbl('<span><b>Bottom</b> of the phone</span>', 'tp-near')}
      <p class="tp-cap"><span class="tp-status" role="status">${status}</span><span class="tp-meta">${esc(caption)}${opts.note ? ' · ' + opts.note : ''}</span></p>
    </div>`;
  }
  // setup seats -> preview seats (local or playgroup)
  function setupPreviewSeats() {
    const s = getSetup();
    if (gm()) return groupSeats().slice(0, s.count).map((seat, i) => {
      const ph = `Player ${i + 1}`;
      if (seat.kind === 'member') { const m = memberById(seat.userId); const d = deckById(seat.deckId); return { name: m ? m.display_name : '', ph, cmd: d ? deckLabel(d) : '', colors: d ? d.colors : [] }; }
      if (seat.kind === 'guest') { const c = seat.commander; return { name: seat.name, ph, guest: true, cmd: c && c.name ? (c.partner ? `${c.name} + ${c.partner}` : c.name) : '', colors: c ? c.colors : [] }; }
      return { name: '', ph, cmd: '', colors: [] };
    });
    return s.seats.slice(0, s.count).map((seat, i) => { const c = getCmd(seat.commanderId); return { name: seat.name.trim(), ph: `Player ${i + 1}`, cmd: c ? cmdLabel(c) : '', colors: c ? c.colors : [] }; });
  }
  function setupPreviewHtml() {
    const s = getSetup(); if (tpSel != null && tpSel >= s.count) tpSel = null;
    const random = data.settings.randomFirst;
    return tablePreviewHtml(setupPreviewSeats(), { sel: tpSel, first: random ? -1 : 0, note: random ? '1st player: random after Start' : 'seat 1 goes first unless you pick another' });
  }
  function repaintSetupPreview() { const el = $('#view .tp'); if (el) el.outerHTML = setupPreviewHtml(); }
  function flashSeats(root, a, b) { [a, b].forEach((i) => { const el = root.querySelector(`.tp-seat[data-tp="${i}"]`); if (el) el.classList.add('swapped'); }); }
  // swap two setup seats: names / commanders (local) or member / deck / guest / bracket override (playgroup)
  function swapSetupSeats(a, b) {
    const arr = gm() ? groupSeats() : getSetup().seats;
    [arr[a], arr[b]] = [arr[b], arr[a]]; save();
  }
  function tapSetupSeat(i) {
    if (tpSel == null) { tpSel = i; repaintSetupPreview(); return; }
    if (tpSel === i) { tpSel = null; repaintSetupPreview(); return; }
    const a = tpSel; tpSel = null; swapSetupSeats(a, i);
    const y = window.scrollY; renderTab(); window.scrollTo(0, y);
    flashSeats($('#view'), a, i); toast(`Swapped seats ${a + 1} and ${i + 1}`);
  }
  // in game (from the game menu): reorder the players; ids stay, so life, damage, counters, monarch and the first
  // player all follow the person. seat = new position (seat colour + number), like a game started in that order.
  function swapGameSeats(a, b) {
    const g = G(); if (!g || a === b) return;
    [g.players[a], g.players[b]] = [g.players[b], g.players[a]];
    g.players.forEach((p, i) => { p.seat = i; });
    const s = getSetup(); // keep the setup in step so "Rematch" / the next game uses the corrected order
    if (s.count === g.players.length) { if (g.groupId && gm() && cloud.groupId() === g.groupId) { const gs = groupSeats(); [gs[a], gs[b]] = [gs[b], gs[a]]; } else if (!g.groupId) [s.seats[a], s.seats[b]] = [s.seats[b], s.seats[a]]; }
    save(true); renderGame();
  }
  function gamePreviewHtml(sel) {
    const g = G(); const fi = g.players.findIndex((p) => p.id === g.firstPlayerId);
    return tablePreviewHtml(g.players.map((p) => ({ name: p.name, ph: p.name, cmd: p.commanderName ? (p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName) : '', colors: p.colors, guest: p.kind === 'guest' })),
      { sel, first: fi, ords: fi >= 0, note: fi >= 0 ? 'turns go clockwise from 1st' : 'no first player picked yet' });
  }
  function openSeatSwap() {
    const g = G(); if (!g) return; let sel = null;
    const ov = openSheet(`<div class="sheet-head"><div><h2>Seats</h2><div class="muted small">Swap seats without losing anything</div></div><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body"><div data-role="tp"></div><button class="btn primary block" data-close>Done</button></div>`, { cls: 'seat-swap' });
    const box = ov.querySelector('[data-role=tp]');
    const draw = () => { if (!G()) return; box.innerHTML = gamePreviewHtml(sel); };
    ov._refresh = draw;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tp]'); if (!b) return; const i = +b.dataset.tp;
      if (sel == null || sel === i) { sel = sel === i ? null : i; draw(); return; }
      const a = sel; sel = null; swapGameSeats(a, i); draw(); flashSeats(box, a, i);
      toast(`Swapped ${G().players[i].name} and ${G().players[a].name}`);
    });
    draw();
  }

  // setup: the bracket button next to a seat's commander / deck
  function seatBrBtn(i, b, what) {
    b = normBracket(b);
    return `<button class="seat-br ${b ? '' : 'empty'}" data-act="seatBracket" data-i="${i}" aria-label="${b ? `Bracket ${b}, ${BR_NAME[b]}` : 'Set bracket'} for ${esc(what)}">${b ? bchip(b) : `${I.bracket}<span>Bracket</span>`}</button>`;
  }
  // local seats: the bracket is saved on the commander (group seats: see openGroupSeatBracket)
  function openSeatBracket(i) {
    if (gm()) { openGroupSeatBracket(i); return; }
    const c = getCmd(getSetup().seats[i].commanderId); if (!c) return;
    const ov = openSheet(`<div class="sheet-head"><div><h2>Bracket</h2><div class="muted small ellipsis"><span class="pips">${pips(c.colors)}</span> ${esc(cmdLabel(c))}</div></div><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">${bracketPicker(c.bracket)}<p class="hint">Saved on this commander and used for its next games. Change it for one game only from the ⋯ menu during the game.</p>
      <button class="btn primary block" data-close>Done</button></div>`, { onClose: () => renderTab() });
    bindBracketPicker(ov, () => normBracket(c.bracket), (v) => { c.bracket = v; save(); });
  }

  function openCmdPicker(i) {
    const s = getSetup(); const seatName = s.seats[i].name.trim().toLowerCase();
    let q = '';
    const last = lastPlayedMap();
    const ov = openSheet(`<div class="sheet-head"><h2>Commander · seat ${i + 1}</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body"><input type="search" class="search" placeholder="Search or type a new commander" aria-label="Search or type a new commander" data-role="q" autocomplete="off" autocapitalize="words">
      <div class="pick-list" data-role="list"></div></div>`, { cls: 'tall' });
    const list = ov.querySelector('[data-role=list]');
    const draw = () => {
      const ql = q.trim().toLowerCase();
      const cs = data.commanders.filter((c) => !ql || cmdLabel(c).toLowerCase().includes(ql) || c.owner.toLowerCase().includes(ql))
        .sort((a, b) => ((b.owner.toLowerCase() === seatName) - (a.owner.toLowerCase() === seatName)) || ((last.get(b.id) || 0) - (last.get(a.id) || 0)) || a.name.localeCompare(b.name));
      const exact = data.commanders.some((c) => c.name.toLowerCase() === ql); const link = isDeckLink(q);
      list.innerHTML = `${link ? `<button class="pick-row new imp-pick" data-import="1">${I.link}<span>Import this deck’s commander</span></button>` : ''}
        ${ql && !exact && !link ? `<button class="pick-row new" data-new>+ Create “${esc(q.trim())}”</button>` : ''}
        ${!ql ? `<button class="pick-row new" data-new>+ New commander</button>${IMP ? `<button class="pick-row new imp-pick" data-import>${I.link}<span>Import from Archidekt / Moxfield</span></button>` : ''}` : ''}
        ${cs.map((c) => `<button class="pick-row ${c.id === s.seats[i].commanderId ? 'on' : ''}" data-id="${c.id}"><span class="pips">${pips(c.colors)}</span><span class="pr-main"><b>${esc(cmdLabel(c))}</b>${c.owner || c.bracket ? `<small class="pr-sub">${bchip(c.bracket)}${c.owner ? `<span class="ellipsis">${esc(c.owner)}</span>` : ''}</small>` : ''}</span></button>`).join('')}
        ${s.seats[i].commanderId ? '<button class="pick-row clear" data-id="">No commander</button>' : ''}
        ${!cs.length && !ql ? '<p class="muted small center">No saved commanders yet.</p>' : ''}`;
    };
    ov.querySelector('[data-role=q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-new') || b.hasAttribute('data-import')) {
        closeOverlay(ov);
        const imp = b.hasAttribute('data-import');
        openCmdEditor(null, { name: imp ? '' : q.trim(), owner: s.seats[i].name.trim(), importOpen: imp, importSrc: imp && isDeckLink(q) ? q.trim() : '', onSave: (c) => {
          s.seats[i].commanderId = c.id; if (!s.seats[i].name.trim() && c.owner) s.seats[i].name = c.owner; save(); renderTab();
        } });
        return;
      }
      const id = b.dataset.id || null; s.seats[i].commanderId = id;
      const c = getCmd(id); if (c && !s.seats[i].name.trim() && c.owner) s.seats[i].name = c.owner;
      save(); closeOverlay(ov); renderTab();
    });
    draw();
  }

  // ---------- v1.8: "Import from link" (only the commanders of an Archidekt / Moxfield deck, never the 99; see import.js) ----------
  const IMP = window.EDHImport || null;
  const cmdKey = (a, b) => [a, b].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).sort().join(' + ');
  const deckKey = (deck) => cmdKey(deck.commanders[0] && deck.commanders[0].name, deck.commanders[1] && deck.commanders[1].name);
  const isDeckLink = (q) => { const r = IMP && IMP.parseLink(q); return !!(r && !r.error); };
  function importBoxHtml(opts = {}) {
    if (!IMP) return '';
    const open = !!(opts.open || opts.src);
    return `<div class="imp ${open ? 'open' : ''}" data-role="imp">
      <button type="button" class="imp-toggle" data-imp="toggle" aria-expanded="${open}">${I.link}<span><b>Import from link</b><small>Archidekt or Moxfield · commanders only, never the 99</small></span></button>
      <div class="imp-body" ${open ? '' : 'hidden'}>
        <div class="imp-row"><textarea data-imp="src" rows="1" placeholder="Paste a deck link" aria-label="Archidekt or Moxfield deck link" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="go">${esc(opts.src || '')}</textarea><button type="button" class="btn primary sm" data-imp="go">Find</button></div>
        <div class="imp-help">No link? Paste the deck’s text export, or type the commander’s name.</div>
        <div class="imp-out" data-imp="out" aria-live="polite"></div>
      </div></div>`;
  }
  function importPreviewHtml(deck, dup, saveLabel) {
    return `<div class="imp-card" style="--deck:${manaGrad(deck.colors, '90deg')}">
      <div class="imp-found">Found: <b>${esc(deck.commanders.map((c) => c.name).join(' + '))}</b> · <span class="imp-ci" role="img" aria-label="${colorWords(deck.colors)}">${IMP.ciString(deck.colors)}</span></div>
      <div class="imp-meta"><span class="pips">${pips(deck.colors)}</span>${deck.name ? `<span class="ellipsis">“${esc(deck.name)}”</span>` : ''}${bchip(deck.bracket)}${deck.bracketAuto ? '<small>estimated</small>' : ''}<span class="imp-src">${esc(deck.site)}</span></div>
      ${deck.extra ? `<div class="imp-note">${deck.extra} more commander card${deck.extra === 1 ? '' : 's'} ignored (2 at most).</div>` : ''}
      ${dup ? `<div class="imp-dup"><div>Already saved: <b>${esc(dup.label)}</b>${dup.who ? ` <span class="muted">· ${esc(dup.who)}</span>` : ''}. Update it instead of adding a duplicate?</div>
        <div class="row"><button type="button" class="btn sm primary" data-imp="update">Update it</button><button type="button" class="btn sm ghost" data-imp="keep">Add as new</button></div></div>`
        : `<div class="imp-note">Filled in below. Check it, then tap <b>${esc(saveLabel)}</b>.</div>`}
    </div>`;
  }
  function paintColors(root, colors) {
    root.querySelectorAll('.color-toggles [data-color]').forEach((t) => { const on = colors.includes(t.dataset.color); t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); });
  }
  // wires the import box inside a form. cfg: { saveLabel, apply(deck), dup(deck) -> { item, label, who } | null, onUpdate(deck, item), auto }
  function bindImport(ov, cfg) {
    const box = ov.querySelector('[data-role=imp]'); if (!box) return { found: null, dup: null };
    const src = box.querySelector('[data-imp=src]'); const out = box.querySelector('[data-imp=out]'); const body = box.querySelector('.imp-body');
    const tog = box.querySelector('[data-imp=toggle]');
    const st = { found: null, dup: null, seq: 0 };
    const grow = () => { src.style.height = 'auto'; src.style.height = Math.min(src.scrollHeight + 2, 150) + 'px'; };
    const setOpen = (on, focus) => {
      body.hidden = !on; box.classList.toggle('open', on); tog.setAttribute('aria-expanded', on);
      if (on) { grow(); if (focus) { try { src.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } } }
    };
    const run = async () => {
      const q = src.value.trim(); const my = ++st.seq;
      if (!q) { out.innerHTML = `<div class="imp-err" role="alert">${IMP.message({ code: 'empty' })}</div>`; return; }
      out.innerHTML = '<div class="imp-busy"><span class="spinner"></span>Looking it up…</div>'; box.classList.add('busy');
      try {
        const deck = await IMP.importAny(q);
        if (my !== st.seq || !document.contains(box)) return;
        st.found = deck; st.dup = cfg.dup ? cfg.dup(deck) : null;
        cfg.apply(deck);
        out.innerHTML = importPreviewHtml(deck, st.dup, cfg.saveLabel);
      } catch (e) {
        if (my !== st.seq || !document.contains(box)) return;
        if (!(e instanceof IMP.ImportError)) console.warn('import failed', e);
        st.found = null; st.dup = null;
        out.innerHTML = `<div class="imp-err" role="alert">${IMP.message(e)}</div>`;
      } finally { if (my === st.seq) box.classList.remove('busy'); }
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-imp]'); if (!b || b.tagName === 'TEXTAREA') return;
      const k = b.dataset.imp;
      if (k === 'toggle') setOpen(body.hidden, true);
      else if (k === 'go') run();
      else if (k === 'update' && st.found && st.dup && cfg.onUpdate) cfg.onUpdate(st.found, st.dup.item);
      else if (k === 'keep') { st.dup = null; const d = out.querySelector('.imp-dup'); if (d) d.outerHTML = `<div class="imp-note">Adding a new one. Tap <b>${esc(cfg.saveLabel)}</b> when ready.</div>`; }
    });
    src.addEventListener('input', grow);
    src.addEventListener('paste', () => setTimeout(() => { grow(); if (isDeckLink(src.value)) run(); }, 0));
    src.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); run(); } });
    if (!body.hidden) grow();
    if (cfg.auto && src.value.trim()) run();
    return st;
  }
  // "update instead of duplicating?" at save time (when the Update / Add as new choice in the preview wasn't made)
  async function askDuplicate(dup) {
    return choiceDialog(`<b>${esc(dup.label)}</b>${dup.who ? ` (${esc(dup.who)})` : ''} is already saved. Update it instead of adding a duplicate?`,
      [{ label: 'Update existing', value: 'update', cls: 'primary' }, { label: 'Add a new one', value: 'new' }]);
  }
  const linkedHtml = (link) => (cleanLink(link) ? `<div class="imp-linked">${I.link}<span>Imported from <a href="${esc(link)}" target="_blank" rel="noopener">${linkSite(link)}</a> (commanders only)</span></div>` : '');

  function openCmdEditor(id, opts = {}) {
    const c = getCmd(id);
    const st = { name: c ? c.name : opts.name || '', partner: c ? c.partner : '', colors: c ? c.colors.slice() : [], owner: c ? c.owner : opts.owner || '', bracket: c ? normBracket(c.bracket) : null, link: c ? cleanLink(c.link) : '' };
    const stats = c ? commanderStats().get(c.id) : null;
    const recent = c ? data.games.filter((g) => g.players.some((p) => p.commanderId === c.id)).slice(0, 5) : [];
    const ov = openSheet(`<div class="sheet-head"><h2>${c ? 'Edit commander' : 'New commander'}</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        ${importBoxHtml({ open: opts.importOpen, src: opts.importSrc })}
        <div class="field"><label>Commander name</label><input type="text" data-f="name" value="${esc(st.name)}" placeholder="e.g. Atraxa, Praetors' Voice" autocapitalize="words" maxlength="80"></div>
        <div class="field"><label>Partner / background <span class="muted">(optional)</span></label><input type="text" data-f="partner" value="${esc(st.partner)}" placeholder="Second commander, if any" autocapitalize="words" maxlength="80"></div>
        <div class="field"><label>Color identity</label><div class="color-toggles">${WUBRG.map((x) => `<button class="ctog pip-${x} ${st.colors.includes(x) ? 'on' : ''}" data-color="${x}" aria-label="${COLOR_NAME[x]}" aria-pressed="${st.colors.includes(x)}">${x}</button>`).join('')}</div><div class="muted small">None selected = colorless</div></div>
        <div class="field"><label>Owner / player <span class="muted">(optional)</span></label><input type="text" data-f="owner" list="owner-names" value="${esc(st.owner)}" placeholder="Who plays this deck" autocapitalize="words" maxlength="40">
          <datalist id="owner-names">${knownPlayers().map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="field br-field"><label>Commander Bracket <span class="muted">(optional)</span></label>${bracketPicker(st.bracket)}</div>
        ${linkedHtml(st.link)}
        ${stats ? `<div class="mini-stats"><div><b>${stats.games}</b><span>games</span></div><div><b>${stats.wins}</b><span>wins</span></div><div><b>${pct(stats.wins, stats.games)}</b><span>win rate</span></div><div><b>${fmtDur(stats.dur / stats.games)}</b><span>avg game</span></div></div>${cmdTurnHtml(stats)}` : ''}
        ${recent.length ? `<div class="sec-title">Recent games</div>${recent.map((g) => { const me = g.players.find((p) => p.commanderId === c.id); return `<div class="recent-row"><span>${fmtShort(g.endedAt)}</span><span class="ellipsis">${me.isWinner ? '🏆 Won' : ordinal(me.place || g.players.length)} · ${g.playerCount}p${normBracket(me.bracket) ? ' · B' + me.bracket : ''}${g.turns ? ' · T' + g.turns : ''}${Number.isInteger(me.turnPos) ? ' · ' + ordinal(me.turnPos) + ' to play' : ''}${me.solRingT1 ? ' · T1 Sol Ring' : ''}</span><span class="muted">${fmtDur(g.durationMs)}</span></div>`; }).join('')}` : ''}
        <div class="sheet-actions">${c ? '<button class="btn danger-text" data-a="delete">Delete</button>' : ''}<button class="btn primary grow" data-a="save">${c ? 'Save' : 'Add commander'}</button></div>
      </div>`, { cls: 'tall' });
    bindBracketPicker(ov.querySelector('.br-field'), () => st.bracket, (v) => { st.bracket = v; });
    const done = (cmd, msg) => { save(true); closeOverlay(ov); toast(msg); if (opts.onSave) opts.onSave(cmd); else renderTab(); };
    const updateExisting = (x, v) => { Object.assign(x, { name: v.name, partner: v.partner, colors: v.colors.slice() }); if (v.bracket) x.bracket = v.bracket; if (v.link) x.link = v.link; done(x, 'Commander updated'); };
    const imp = bindImport(ov, {
      saveLabel: c ? 'Save' : 'Add commander', auto: !!opts.importSrc,
      apply: (deck) => {
        ov.querySelector('[data-f=name]').value = deck.commanders[0].name;
        ov.querySelector('[data-f=partner]').value = deck.commanders[1] ? deck.commanders[1].name : '';
        st.colors = deck.colors.slice(); paintColors(ov, st.colors);
        if (deck.bracket || st.brImported) { st.bracket = deck.bracket; paintBracketPicker(ov.querySelector('.br-field'), deck.bracket); } // a later import without one clears an earlier import's
        st.brImported = !!deck.bracket;
        st.link = deck.url || (c ? cleanLink(c.link) : ''); // the latest import wins; text / typed imports have no link
      },
      // same deck link, or the same commander(s) owned by the same (or an unnamed) player
      dup: (deck) => {
        if (c) return null;
        const k = deckKey(deck); const owner = ov.querySelector('[data-f=owner]').value.trim().toLowerCase();
        const x = data.commanders.filter((y) => ((deck.url && y.link === deck.url) || cmdKey(y.name, y.partner) === k) && !(owner && y.owner && y.owner.toLowerCase() !== owner))
          .sort((a, b) => (b.owner.toLowerCase() === owner) - (a.owner.toLowerCase() === owner))[0];
        return x ? { item: x, label: cmdLabel(x), who: x.owner } : null;
      },
      onUpdate: (deck, x) => updateExisting(x, { name: deck.commanders[0].name, partner: deck.commanders[1] ? deck.commanders[1].name : '', colors: deck.colors, bracket: deck.bracket, link: deck.url }),
    });
    ov.addEventListener('click', async (e) => {
      const tog = e.target.closest('[data-color]');
      if (tog) {
        const x = tog.dataset.color; st.colors = st.colors.includes(x) ? st.colors.filter((y) => y !== x) : WUBRG.filter((y) => y === x || st.colors.includes(y));
        tog.classList.toggle('on', st.colors.includes(x)); tog.setAttribute('aria-pressed', st.colors.includes(x)); return;
      }
      const a = e.target.closest('[data-a]'); if (!a) return;
      $$('[data-f]', ov).forEach((inp) => { st[inp.dataset.f] = inp.value.trim(); });
      if (a.dataset.a === 'save') {
        if (!st.name) { toast('Please enter a commander name'); return; }
        if (!c && imp.found && imp.dup) {
          const pickd = await askDuplicate(imp.dup); if (!pickd) return;
          if (pickd === 'update') { updateExisting(imp.dup.item, st); return; }
        }
        let cmd = c;
        if (cmd) { const { link, brImported, ...rest } = st; Object.assign(cmd, rest); if (link) cmd.link = link; else delete cmd.link; } else { cmd = sanitizeCommander({ ...st, id: uid(), createdAt: Date.now() }); data.commanders.push(cmd); }
        done(cmd, c ? 'Commander updated' : 'Commander added');
      } else if (a.dataset.a === 'delete') {
        if (!(await confirmDialog(`Delete <b>${esc(c.name)}</b>? Past games keep their record, but it won't show in the commanders list.`, 'Delete', true))) return;
        data.commanders = data.commanders.filter((x) => x.id !== c.id);
        if (data.lastSetup) data.lastSetup.seats.forEach((s) => { if (s.commanderId === c.id) s.commanderId = null; });
        save(true); closeOverlay(ov); renderTab(); toast('Commander deleted');
      }
    });
  }

  let starting = false;
  async function startGame() {
    if (starting || !$('#game').hidden) return; // double tap on "Start game" / "Rematch"
    starting = true;
    try { await startGameInner(); } finally { starting = false; }
  }
  async function startGameInner() {
    if (data.current && !(await confirmDialog('A game is in progress. Discard it and start a new one?', 'Discard & start', true))) return;
    const s = getSetup();
    const groupId = gm() ? cloud.groupId() : null;
    const players = groupId ? groupPlayers(s) : s.seats.slice(0, s.count).map((seat, i) => {
      const c = getCmd(seat.commanderId);
      return {
        id: 'p' + i, seat: i, name: seat.name.trim() || `Player ${i + 1}`,
        commanderId: c ? c.id : null, commanderName: c ? c.name : '', partnerName: c ? c.partner : '', colors: c ? c.colors.slice() : [],
        bracket: c ? normBracket(c.bracket) : null, // v1.7: frozen for this game (editing the deck later doesn't change it)
        life: s.life, poison: 0, cmd: {}, tax: [0, 0], eliminated: false, elimOrder: null, elimReason: null, killedBy: null,
      };
    });
    if (!players) return;
    data.current = { id: uid(), groupId, startedAt: Date.now(), startingLife: s.life, players, monarch: null, initiative: null, firstPlayerId: null };
    save(true);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    openGame();
    if (data.settings.randomFirst) setTimeout(pickFirstPlayer, 350);
  }

  // ---------- game ----------
  let clockTimer = null;
  const deltas = {};
  const presses = new Map();
  const G = () => data.current;
  const P = (pid) => data.current.players.find((p) => p.id === pid);

  function openGame() {
    $('#app').hidden = true; $('#game').hidden = false;
    document.body.classList.add('in-game');
    renderGame(); requestWakeLock();
    clearInterval(clockTimer); centerStart = Date.now(); clockTimer = setInterval(updateCenter, 500);
  }
  function closeGame() {
    $('#game').hidden = true; $('#app').hidden = false; $('#game').innerHTML = '';
    document.body.classList.remove('in-game');
    clearInterval(clockTimer); releaseWakeLock(); renderTab();
  }
  // v1.6: one-time hint on the first game. Its own key, so the saved data format is unchanged.
  const HINT_KEY = 'edh-tracker:tapHint'; let hintTimer = null;
  const hintSeen = () => { try { return !!localStorage.getItem(HINT_KEY); } catch (e) { return true; } };
  function dismissTapHint() {
    const els = $$('#board .tap-hint'); clearTimeout(hintTimer); if (!els.length) return;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* private mode */ }
    els.forEach((el) => { el.classList.add('out'); setTimeout(() => el.remove(), 400); });
    const sr = $('#tap-hint-sr'); if (sr) sr.remove();
  }
  // v1.6.1: wide layout everywhere. iOS Home Screen apps ignore the manifest orientation, so on an upright screen the whole
  // game layer is turned 90° (CSS, #game.rot90) unless switched off in Settings (a per-device key, not part of the saved data).
  const WIDE_KEY = 'edh-tracker:wideLayout';
  const forceWide = () => { try { return localStorage.getItem(WIDE_KEY) !== '0'; } catch (e) { return true; } };
  function boardMode() {
    const portrait = window.innerHeight > window.innerWidth;
    if (!portrait) return { wide: true, rot: 0, key: 'wide' };
    return forceWide() ? { wide: true, rot: 90, key: 'wide90' } : { wide: false, rot: 0, key: 'tall' };
  }
  let boardKey = '';
  const normRot = (r) => { const x = ((r % 360) + 360) % 360; return x > 180 ? x - 360 : x; }; // -> -90, 0, 90, 180
  // how a player's panel is turned on the physical screen (panel rotation + board rotation): their sheets face them too
  const seatRot = (pid) => { const el = panelEl(pid); return el ? normRot(+(el.dataset.rot || 0) + (boardKey === 'wide90' ? 90 : 0)) : 0; };
  function onBoardResize() {
    if (!data.current || $('#game').hidden || !$('#board')) return;
    const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return; // on-screen keyboard, not a rotation
    if (boardMode().key === boardKey) return;
    renderGame();
    $$('.overlay').forEach((ov) => { if (!ov._pid) return; const fr = ov.querySelector('.rot-frame'); const r = seatRot(ov._pid); fr.style.setProperty('--rot', r + 'deg'); fr.classList.toggle('side', Math.abs(r) === 90); });
  }
  window.addEventListener('resize', onBoardResize);
  window.addEventListener('resize', () => { if ($('#game').hidden && tab === 'play') repaintSetupPreview(); }); // v1.9: preview follows rotation / iPad resize
  window.addEventListener('orientationchange', () => setTimeout(onBoardResize, 300));
  function renderGame() {
    const g = G(); const M = boardMode(); const L = (M.wide ? WIDE_LAYOUTS : TALL_LAYOUTS)[g.players.length]; const hint = !hintSeen();
    boardKey = M.key; $('#game').classList.toggle('rot90', M.rot === 90); $('#game').dataset.layout = M.key;
    $('#game').innerHTML = `<div id="board" class="n${g.players.length} ${M.wide ? 'wide' : 'tall'}" style="grid-template-rows:repeat(${L.rows},1fr);grid-template-columns:repeat(${L.cols},1fr)">
      ${g.players.map((p, i) => {
        const [r, c, span, rot] = L.seats[i];
        return `<div class="cell" style="grid-area:${r}/${c}/span 1/span ${span}"><div class="panel seat-${p.seat} ${Math.abs(rot) === 90 ? 'side' : ''} ${nearClass(L, r, c, span, rot)}" style="--rot:${rot}deg;${safePad(L, r, c, span, rot)}" data-pid="${p.id}" data-rot="${rot}">
          <div class="zone plus" data-d="1" role="button" tabindex="0" aria-label="${esc(p.name)}: gain 1 life (hold for 10)"><span class="z-hint l" aria-hidden="true">+</span><span class="z-hint r" aria-hidden="true">+</span></div>
          <div class="zone minus" data-d="-1" role="button" tabindex="0" aria-label="${esc(p.name)}: lose 1 life (hold for 10)"><span class="z-hint l" aria-hidden="true">−</span><span class="z-hint r" aria-hidden="true">−</span></div>
          <div class="p-head"><div class="p-name"></div><div class="p-cmd"></div></div>
          <button class="p-more" data-act="playerSheet" aria-label="Commander damage & counters">${I.more}</button>
          <div class="p-center"><div class="p-life-box"><div class="p-delta"></div><div class="p-life"></div></div></div>
          <div class="p-foot"><div class="chips"></div></div>
          <div class="p-dead"><div class="skull">${I.skull}</div><div class="p-dead-txt"></div></div>
          ${hint ? `<div class="tap-hint" aria-hidden="true"><span class="th-row th-plus"><i>${I.up}</i><b>Tap</b> +1</span><span class="th-mid"><i>${I.hand}</i>Hold for ±10</span><span class="th-row th-minus"><i>${I.down}</i><b>Tap</b> −1</span></div>` : ''}
        </div></div>`;
      }).join('')}
      ${hint ? '<p class="sr-only" id="tap-hint-sr" role="status">Tip: tap the top half of your panel for plus 1, the bottom half for minus 1, hold for 10.</p>' : ''}
      <button id="center-btn" data-act="gameMenu" aria-label="Game menu"><span class="cb-spin" aria-hidden="true"><span class="cb-face cb-timer"><span class="cb-clock"></span><span class="cb-menu">${I.more}</span></span><span class="cb-face cb-tod"><span class="cb-tod-ico">${I.clock}</span><span class="cb-time"></span></span></span></button>
    </div>`;
    const board = $('#board');
    board.classList.toggle('no-spin', data.settings.spinClock === false);
    board.addEventListener('pointerdown', onPressStart);
    board.addEventListener('touchstart', (e) => { if (e.target.closest('[data-d]')) e.preventDefault(); }, { passive: false });
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    board.addEventListener('keydown', (e) => { // keyboard / switch access to the tap zones
      const z = e.target.closest && e.target.closest('.zone[data-d]'); if (!z || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); const pid = z.closest('.panel').dataset.pid; changeLife(pid, +z.dataset.d * (e.shiftKey ? 10 : 1)); flashZone(z);
    });
    updateAllPanels(); updateCenter();
    clearTimeout(hintTimer); if (hint) hintTimer = setTimeout(dismissTapHint, 15000);
  }
  // Safe-area insets become inner padding, mapped from screen edges to the panel's own (rotated) edges
  function safePad(L, r, c, span, rot) {
    const scr = { t: r === 1 ? 'var(--bt)' : '0px', b: r === L.rows ? 'var(--bb)' : '0px', l: c === 1 ? 'var(--bl)' : '0px', r: c - 1 + span === L.cols ? 'var(--br)' : '0px' };
    // player edge <- screen edge
    const map = rot === 90 ? { t: 'r', r: 'b', b: 'l', l: 't' } : rot === -90 ? { t: 'l', r: 't', b: 'r', l: 'b' } : rot === 180 ? { t: 'b', r: 'l', b: 't', l: 'r' } : { t: 't', r: 'r', b: 'b', l: 'l' };
    return `--pt:${scr[map.t]};--pr:${scr[map.r]};--pb:${scr[map.b]};--pl:${scr[map.l]}`;
  }
  // Which corner/edge of a panel (in the player's own orientation) touches the centre menu button
  function nearClass(L, r, c, span, rot) {
    const x0 = (c - 1) / L.cols, x1 = (c - 1 + span) / L.cols, y0 = (r - 1) / L.rows, y1 = r / L.rows;
    const eps = 1e-6;
    if (0.5 < x0 - eps || 0.5 > x1 + eps || 0.5 < y0 - eps || 0.5 > y1 + eps) return '';
    const sgn = (v) => (Math.abs(v) < eps ? 0 : Math.sign(v));
    const sx = sgn(0.5 - (x0 + x1) / 2), sy = sgn(0.5 - (y0 + y1) / 2);
    const [px, py] = rot === 90 ? [sy, -sx] : rot === -90 ? [-sy, sx] : rot === 180 ? [-sx, -sy] : [sx, sy];
    return 'near-' + (py < 0 ? 't' : py > 0 ? 'b' : 'm') + (px < 0 ? 'l' : px > 0 ? 'r' : 'c');
  }
  function onPressStart(e) {
    const t = e.target.closest('[data-d]'); if (!t) return;
    const panel = t.closest('.panel'); if (!panel) return;
    e.preventDefault();
    const pr = { pid: panel.dataset.pid, d: +t.dataset.d, el: t, long: false };
    t.classList.add('pressed');
    pr.timer = setTimeout(() => {
      pr.long = true; changeLife(pr.pid, pr.d * 10); flashZone(t);
      pr.rep = setInterval(() => { changeLife(pr.pid, pr.d * 10); flashZone(t); }, 650);
    }, 450);
    presses.set(e.pointerId, pr);
  }
  function endPress(id, cancel) {
    const pr = presses.get(id); if (!pr) return;
    presses.delete(id); clearTimeout(pr.timer); clearInterval(pr.rep); pr.el.classList.remove('pressed');
    if (!pr.long && !cancel && data.current) { changeLife(pr.pid, pr.d); flashZone(pr.el); }
  }
  // brief glow on the tapped half (restarted on every tap so rapid taps each show)
  function flashZone(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  window.addEventListener('pointerup', (e) => endPress(e.pointerId, false));
  window.addEventListener('pointercancel', (e) => endPress(e.pointerId, true));

  const panelEl = (pid) => $(`#board .panel[data-pid="${pid}"]`);
  function updateAllPanels() { if (data.current) data.current.players.forEach(updatePanel); }
  function updatePanel(p) {
    const el = panelEl(p.id); if (!el) return; const g = G();
    el.querySelector('.p-name').textContent = p.name;
    el.querySelector('.p-cmd').innerHTML = `${bchip(p.bracket, 'in-game')}${p.commanderName ? `<span class="pips">${pips(p.colors)}</span><span class="ellipsis">${esc(p.commanderName)}${p.partnerName ? ' + ' + esc(p.partnerName) : ''}</span>` : ''}`;
    el.querySelector('.p-life').textContent = p.life;
    el.classList.toggle('low', p.life <= 10 && !p.eliminated);
    el.classList.toggle('dead', p.eliminated);
    el.querySelector('.p-dead-txt').textContent = p.eliminated ? `Out · ${REASON[p.elimReason] || ''}` : '';
    el.querySelector('.chips').innerHTML = chipsHtml(p);
  }
  function chipsHtml(p) {
    const g = G(); const out = [];
    for (const [k, v] of Object.entries(p.cmd)) {
      if (!v) continue;
      const [oid, idx] = k.split(':'); const o = P(oid); if (!o) continue;
      out.push(`<button type="button" class="chip cd seat-${o.seat} ${v >= 21 ? 'lethal' : v >= 15 ? 'warn' : ''}" data-act="playerSheet" aria-label="${v} commander damage from ${esc(o.name)}${idx === '1' ? ' (partner)' : ''}"><i></i>${I.sword}${v}${idx === '1' ? '<sup>P</sup>' : ''}</button>`);
    }
    if (p.poison) out.push(`<button type="button" class="chip poison ${p.poison >= 7 ? 'warn' : ''}" data-act="playerSheet" aria-label="${p.poison} poison">${I.poison}${p.poison}</button>`);
    if (p.tax[0] || p.tax[1]) { const tx = `+${p.tax[0] * 2}${p.partnerName ? '/+' + p.tax[1] * 2 : ''}`; out.push(`<button type="button" class="chip tax" data-act="playerSheet" aria-label="Commander tax ${tx}">${I.cycle}<span class="lbl">Tax </span>${tx}</button>`); }
    if (g.monarch === p.id) out.push(`<span class="chip crown" role="img" aria-label="Monarch">${I.crown}<span class="lbl">Monarch</span></span>`);
    if (g.initiative === p.id) out.push(`<span class="chip init" role="img" aria-label="Initiative">${I.castle}<span class="lbl">Initiative</span></span>`);
    if (p.solRing) out.push(`<button type="button" class="chip sol" data-act="playerSheet" aria-label="Turn 1 Sol Ring">${I.solring}<span class="lbl">Sol Ring</span></button>`);
    return out.join('');
  }
  // Centre button (v1.5.2): the game timer slowly turns (CSS animation on .cb-spin) so every seat can read it, and every
  // CENTER.every ms it cross-fades to the time of day for CENTER.show ms. Tests shorten the cycle via __edh.setCenterCycle.
  const CENTER = { every: 20000, show: 4000 };
  let centerStart = Date.now();
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const timeOfDay = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function updateCenter() {
    const g = G(); const b = $('#center-btn'); if (!g || !b || document.hidden) return;
    setText(b.querySelector('.cb-clock'), fmtClock(Date.now() - g.startedAt));
    const t = (Date.now() - centerStart) % (CENTER.every + CENTER.show);
    const tod = t >= CENTER.every;
    if (tod) setText(b.querySelector('.cb-time'), timeOfDay());
    b.classList.toggle('show-tod', tod);
  }
  function bumpDelta(p, d) {
    const s = deltas[p.id] || (deltas[p.id] = { v: 0, t: null });
    s.v += d; clearTimeout(s.t);
    s.t = setTimeout(() => { s.v = 0; showDelta(p.id); }, 1800);
    showDelta(p.id);
  }
  function showDelta(pid) {
    const el = panelEl(pid); if (!el) return; const d = el.querySelector('.p-delta');
    const v = (deltas[pid] && deltas[pid].v) || 0;
    d.textContent = v ? (v > 0 ? '+' : '') + v : '';
    d.classList.toggle('show', !!v); d.classList.toggle('neg', v < 0);
  }
  function changed(p) { checkElim(p); updatePanel(p); refreshOverlays(); save(); }
  function changeLife(pid, d) { const p = P(pid); if (!p) return; dismissTapHint(); p.life += d; bumpDelta(p, d); changed(p); }
  function changeCmd(p, key, d) {
    const cur = p.cmd[key] || 0; const nv = Math.max(0, cur + d); const real = nv - cur; if (!real) return;
    p.cmd[key] = nv; p.life -= real; bumpDelta(p, -real); changed(p);
  }
  function changePoison(p, d) { p.poison = Math.max(0, p.poison + d); changed(p); }
  function changeTax(p, i, d) { p.tax[i] = Math.max(0, p.tax[i] + d); changed(p); }

  function lossReason(p) {
    if (Object.values(p.cmd).some((v) => v >= 21)) return 'commander';
    if (p.poison >= 10) return 'poison';
    if (p.life <= 0) return 'life';
    return null;
  }
  function checkElim(p) {
    const r = lossReason(p);
    if (r && !p.eliminated) eliminate(p, r);
    else if (!r && p.eliminated && p.elimReason !== 'conceded') revive(p);
    else if (r && p.eliminated && p.elimReason !== 'conceded' && p.elimReason !== r) { p.elimReason = r; setKiller(p); }
  }
  function setKiller(p) {
    p.killedBy = null;
    if (p.elimReason === 'commander') {
      const k = Object.keys(p.cmd).find((key) => p.cmd[key] >= 21);
      if (k) p.killedBy = k.split(':')[0];
    }
  }
  function eliminate(p, reason) {
    const g = G();
    p.eliminated = true; p.elimReason = reason;
    p.elimOrder = g.players.filter((x) => x.eliminated && x !== p).length + 1;
    setKiller(p);
    toast(`${p.name} is out (${REASON[reason]})`);
    afterElimChange();
  }
  function revive(p) {
    const order = p.elimOrder;
    Object.assign(p, { eliminated: false, elimReason: null, elimOrder: null, killedBy: null });
    G().players.forEach((x) => { if (x.elimOrder && x.elimOrder > order) x.elimOrder--; });
    afterElimChange();
  }
  let winnerPromptTimer = null;
  function afterElimChange() {
    updateAllPanels();
    const alive = G().players.filter((p) => !p.eliminated);
    clearTimeout(winnerPromptTimer);
    if (alive.length === 1) {
      winnerPromptTimer = setTimeout(() => {
        const g = G(); if (!g) return; const a = g.players.filter((p) => !p.eliminated);
        if (a.length === 1 && !$('.overlay.end-open')) { $$('.overlay').forEach(closeOverlay); openEndGame(a[0].id); }
      }, 900);
    }
  }

  function pickFirstPlayer() {
    const g = G(); if (!g) return;
    const alive = g.players.filter((p) => !p.eliminated); if (!alive.length) return;
    const winner = alive[rand(alive.length)];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; // no flashing roulette, just the result
    const steps = alive.length * 3 + alive.indexOf(winner);
    let i = reduceMotion ? steps : 0;
    const tick = () => {
      if (G() !== g) return;
      $$('#board .panel').forEach((el) => el.classList.remove('picking'));
      const cur = alive[i % alive.length]; const el = panelEl(cur.id); if (el) el.classList.add('picking');
      if (i >= steps) {
        setTimeout(() => { if (el) el.classList.remove('picking'); }, 900);
        g.firstPlayerId = winner.id;
        updateAllPanels(); save(); toast(`🎲 ${winner.name} goes first!`); return;
      }
      i++; setTimeout(tick, 60 + i * 9);
    };
    tick();
  }

  function openPlayerSheet(pid) {
    const g = G(); const p = P(pid); const rot = seatRot(pid);
    const ov = openSheet(`<div class="sheet-head"><div class="sh-l"><span class="seat-dot seat-${p.seat}"></span><div class="sh-t"><h2>${esc(p.name)}</h2><div class="muted small ellipsis">${p.commanderName ? `<span class="pips">${pips(p.colors)}</span> ${esc(p.commanderName)}${p.partnerName ? ' + ' + esc(p.partnerName) : ''}` : 'No commander'}</div></div></div>
      <div class="sh-life"><span data-role="life"></span><small>life</small></div><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body" data-role="body"></div>`, { rot, cls: 'player-sheet' });
    ov._pid = pid;
    const body = ov.querySelector('[data-role=body]');
    const draw = () => { body.innerHTML = playerSheetBody(p); ov.querySelector('[data-role=life]').textContent = p.life; };
    ov._refresh = draw;
    bindBracketPicker(body, () => normBracket(p.bracket), (v) => { p.bracket = v; updatePanel(p); save(); setTimeout(() => { if (!ov._closing) draw(); }, 0); });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-pa]'); if (!b) return;
      const a = b.dataset.pa; const d = +b.dataset.d || 0;
      if (a === 'cmd') changeCmd(p, b.dataset.k, d);
      else if (a === 'poison') changePoison(p, d);
      else if (a === 'tax') changeTax(p, +b.dataset.i, d);
      else if (a === 'life') changeLife(p.id, d);
      else if (a === 'monarch' || a === 'initiative') { g[a] = g[a] === p.id ? null : p.id; updateAllPanels(); save(); }
      else if (a === 'solring') { p.solRing = !p.solRing; updatePanel(p); save(); }
      else if (a === 'concede') {
        if (p.eliminated) {
          if (lossReason(p)) { toast('Still lethal — fix life / damage / poison first'); return; }
          revive(p); save();
        } else if (await confirmDialog(`Eliminate ${esc(p.name)} (concede)?`, 'Eliminate', true, rot)) { eliminate(p, 'conceded'); save(); }
      }
      if (!ov._closing) draw();
    });
    draw();
  }
  function counterRow(label, val, attrs, cls = '', max = '', what = '') {
    return `<div class="cnt-row ${cls}">${label}<button class="cbtn" ${attrs} data-d="-1" aria-label="${what ? 'Less ' + what : 'minus'}">−</button><span class="cnt-val">${val}${max ? `<small>/${max}</small>` : ''}</span><button class="cbtn plus" ${attrs} data-d="1" aria-label="${what ? 'More ' + what : 'plus'}">+</button></div>`;
  }
  function playerSheetBody(p) {
    const g = G(); const opps = g.players.filter((o) => o.id !== p.id);
    const cmdRows = opps.map((o) => {
      const srcs = [o.commanderName || 'Commander']; if (o.partnerName) srcs.push(o.partnerName);
      return srcs.map((nm, idx) => {
        const k = o.id + ':' + idx; const v = p.cmd[k] || 0;
        return counterRow(`<span class="seat-dot sm seat-${o.seat}"></span><div class="cnt-label"><b>${esc(o.name)}</b><small>${esc(nm)}</small></div>`, v, `data-pa="cmd" data-k="${k}"`, v >= 21 ? 'lethal' : v >= 15 ? 'warn' : '', '', `commander damage from ${esc(o.name)} (${esc(nm)})`);
      }).join('');
    }).join('');
    const taxRows = [p.commanderName || 'Commander'].concat(p.partnerName ? [p.partnerName] : []).map((nm, i) =>
      counterRow(`<span class="cnt-ico tax">${I.cycle}</span><div class="cnt-label"><b>Casts: ${esc(nm)}</b><small>Tax +${p.tax[i] * 2}</small></div>`, p.tax[i], `data-pa="tax" data-i="${i}"`, '', '', `casts of ${esc(nm)}`)).join('');
    return `<div class="ps-grid">
      <section><div class="sec-title">Commander damage taken</div>${cmdRows}<p class="hint">Also reduces life. 21 from a single commander is lethal.</p></section>
      <section><div class="sec-title">Life & counters</div>
        ${counterRow(`<span class="cnt-ico life">${I.heart}</span><div class="cnt-label"><b>Life</b><small>adjust by 1</small></div>`, p.life, 'data-pa="life"', '', '', 'life')}
        ${counterRow(`<span class="cnt-ico poison">${I.poison}</span><div class="cnt-label"><b>Poison</b><small>10 = loss</small></div>`, p.poison, 'data-pa="poison"', p.poison >= 10 ? 'lethal' : p.poison >= 7 ? 'warn' : '', 10, 'poison')}
        ${taxRows}
        <div class="ps-br"><div class="ps-br-head"><span class="cnt-ico br">${I.bracket}</span><div class="cnt-label"><b>Bracket</b><small>${normBracket(p.bracket) ? `${p.bracket} · ${BR_NAME[p.bracket]} · ` : ''}this game only</small></div></div>${bracketPicker(p.bracket, { desc: false, label: 'Bracket for this game' })}</div>
        <div class="toggle-row three"><button class="tbtn ${g.monarch === p.id ? 'on' : ''}" data-pa="monarch" aria-pressed="${g.monarch === p.id}">${I.crown}Monarch</button><button class="tbtn ${g.initiative === p.id ? 'on' : ''}" data-pa="initiative" aria-pressed="${g.initiative === p.id}">${I.castle}Initiative</button>
          <button class="tbtn sol ${p.solRing ? 'on' : ''}" data-pa="solring" aria-pressed="${!!p.solRing}" aria-label="Turn 1 Sol Ring">${I.solring}T1 Sol Ring</button></div>
        ${p.eliminated ? `<div class="out-note">☠ Out ${ordinal(p.elimOrder)} · ${REASON[p.elimReason]}</div>` : ''}
        <button class="btn block ${p.eliminated ? '' : 'danger-outline'}" data-pa="concede">${p.eliminated ? 'Revive player' : 'Concede / eliminate'}</button>
      </section></div>`;
  }

  function openGameMenu() {
    const g = G();
    const ov = openSheet(`<div class="sheet-head"><div><h2>Game menu</h2><div class="muted small" data-role="sub"></div></div><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        <div class="menu-grid">
          <button class="mtile t-violet" data-ga="first"><b>${I.target}</b><span>Random first player</span></button>
          <button class="mtile t-cyan" data-ga="d6"><b>${I.d6}</b><span>Roll d6</span></button>
          <button class="mtile t-orange" data-ga="d20"><b>${I.d20}</b><span>Roll d20</span></button>
          <button class="mtile t-gold" data-ga="coin"><b>${I.coin}</b><span>Flip coin</span></button>
        </div>
        <button class="btn ghost block seats-btn" data-ga="seats">${I.seats}Rearrange seats</button>
        <button class="btn gold block big" data-ga="end">${I.trophy} End game & save</button>
        <div class="row2"><button class="btn ghost" data-ga="restart">Restart</button><button class="btn ghost" data-ga="exit">Exit to menu</button></div>
        <button class="btn ghost danger-text block" data-ga="abandon">Abandon game</button>
        <p class="center"><button class="link-btn" data-act="displayInfo">Display info</button></p>
      </div>`);
    const draw = () => {
      if (!G()) return;
      ov.querySelector('[data-role=sub]').textContent = `${fmtClock(Date.now() - g.startedAt)} elapsed · ${g.players.filter((p) => !p.eliminated).length} of ${g.players.length} players left`;
    };
    ov._refresh = draw; draw();
    ov.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ga]'); if (!b) return;
      const a = b.dataset.ga;
      if (a === 'first') { closeOverlay(ov); pickFirstPlayer(); }
      else if (a === 'seats') { closeOverlay(ov); openSeatSwap(); }
      else if (a === 'd6' || a === 'd20' || a === 'coin') showRoll(a);
      else if (a === 'end') { closeOverlay(ov); openEndGame(); }
      else if (a === 'exit') { closeOverlay(ov); closeGame(); }
      else if (a === 'restart') {
        if (!(await confirmDialog('Restart with the same players? Life and counters reset; this game is not saved.', 'Restart', true))) return;
        closeOverlay(ov);
        g.players.forEach((p) => Object.assign(p, { life: g.startingLife, poison: 0, cmd: {}, tax: [0, 0], eliminated: false, elimOrder: null, elimReason: null, killedBy: null, solRing: false }));
        Object.assign(g, { id: uid(), startedAt: Date.now(), monarch: null, initiative: null, firstPlayerId: null });
        clearTimeout(winnerPromptTimer); Object.values(deltas).forEach((x) => clearTimeout(x.t)); Object.keys(deltas).forEach((k) => delete deltas[k]);
        save(true); renderGame();
        if (data.settings.randomFirst) setTimeout(pickFirstPlayer, 350);
      } else if (a === 'abandon') {
        if (!(await confirmDialog('Abandon this game without saving it?', 'Abandon', true))) return;
        closeOverlay(ov); data.current = null; save(true); closeGame();
      }
    });
  }
  function showRoll(kind) {
    const roll = () => (kind === 'coin' ? (rand(2) ? 'Heads' : 'Tails') : String(rand(kind === 'd6' ? 6 : 20) + 1));
    const ov = openSheet(`<div class="dialog-body center"><div class="muted">${kind === 'coin' ? 'Coin flip' : 'Rolling ' + kind}</div><div class="roll-result pop" data-role="r">${roll()}</div>
      <div class="dialog-actions"><button class="btn primary" data-role="again">Again</button><button class="btn ghost" data-close>Close</button></div></div>`, { dialog: true });
    ov.querySelector('[data-role=again]').addEventListener('click', () => {
      const r = ov.querySelector('[data-role=r]'); r.classList.remove('pop'); void r.offsetWidth; r.textContent = roll(); r.classList.add('pop');
    });
  }

  function openEndGame(preWinner) {
    const g = G(); if (!g) return;
    const alive = g.players.filter((p) => !p.eliminated);
    let winner = preWinner || (alive.length === 1 ? alive[0].id : null);
    const mins = Math.max(1, Math.round((Date.now() - g.startedAt) / 60000));
    const ov = openSheet(`<div class="sheet-head"><h2>End game</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        <div class="field turns-q"><label>How many turns did the game take?</label>
          <div class="stepper"><button class="cbtn" data-step="-1" aria-label="fewer turns">−</button><input type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="999" data-f="turns" placeholder="?" aria-label="Number of turns"><button class="cbtn plus" data-step="1" aria-label="more turns">+</button></div>
          <div class="muted small">Leave blank if unknown.</div></div>
        <div class="field dur-field"><label>Duration (minutes)</label><input type="number" inputmode="numeric" min="1" max="1440" data-f="mins" value="${mins}"></div>
        <div class="sec-title">Who won?</div><div class="win-list" data-role="list"></div>
        <div class="sec-title">Turn order</div><div class="to-list" data-role="order"></div>
        <p class="hint" data-role="order-hint"></p>
        <div class="sec-title">Turn 1 Sol Ring?</div><div class="sol-list" data-role="sol"></div>
        <button class="btn primary big block" data-role="save">Save game</button>
      </div>`, { cls: 'tall' });
    ov.classList.add('end-open');
    const list = ov.querySelector('[data-role=list]');
    const draw = () => {
      const sorted = g.players.slice().sort((a, b) => (a.eliminated - b.eliminated) || ((b.elimOrder || 0) - (a.elimOrder || 0)));
      list.innerHTML = sorted.map((p) => `<button class="win-row ${winner === p.id ? 'on' : ''}" data-w="${p.id}"><span class="seat-dot sm seat-${p.seat}"></span>
        <span class="pr-main"><b>${esc(p.name)}</b><small>${brBadge(p.bracket)}${p.commanderName ? pips(p.colors) + ' ' + esc(p.commanderName) : 'No commander'}</small></span>
        <span class="win-status">${p.eliminated ? `Out ${ordinal(p.elimOrder)}<small>${REASON[p.elimReason]}</small>` : `${p.life} life`}</span><span class="radio"></span></button>`).join('')
        + `<button class="win-row draw ${winner === 'draw' ? 'on' : ''}" data-w="draw"><span class="pr-main"><b>No winner / draw</b></span><span class="radio"></span></button>`;
      ov.querySelector('[data-role=save]').disabled = !winner;
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; winner = b.dataset.w; draw(); });
    // turn order: who went first (random pick / chosen in game, else seat 1) -> everyone else follows clockwise
    const picked = g.players.findIndex((p) => p.id === g.firstPlayerId);
    let first = picked >= 0 ? picked : 0; let chosen = picked >= 0;
    const orderEl = ov.querySelector('[data-role=order]'); const solEl = ov.querySelector('[data-role=sol]');
    const drawOrder = () => {
      const pos = turnPositions(g.players.length, first);
      const byPos = g.players.map((p, i) => ({ p, i, pos: pos[i] })).sort((a, b) => a.pos - b.pos);
      orderEl.innerHTML = byPos.map(({ p, i, pos: k }) => `<button class="to-chip ${k === 1 ? 'on' : ''}" data-first="${i}" aria-pressed="${k === 1}" aria-label="${esc(p.name)}: ${ordinal(k)} to play${k === 1 ? ' (went first)' : ' — tap if they went first'}"><span class="to-pos">${ordinal(k)}</span><span class="seat-dot sm seat-${p.seat}"></span><span class="ellipsis">${esc(p.name)}</span></button>`).join('');
      ov.querySelector('[data-role=order-hint]').textContent = chosen ? 'Tap who went first — the others follow clockwise.' : 'No first player was picked, so seat 1 is assumed. Tap who went first — the others follow clockwise.';
      solEl.innerHTML = byPos.map(({ p }) => `<button class="sol-chip ${p.solRing ? 'on' : ''}" data-sol="${p.id}" aria-pressed="${!!p.solRing}" aria-label="${esc(p.name)}: turn 1 Sol Ring">${I.solring}<span class="seat-dot sm seat-${p.seat}"></span><span class="ellipsis">${esc(p.name)}</span></button>`).join('');
    };
    orderEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-first]'); if (!b) return;
      first = +b.dataset.first; chosen = true; g.firstPlayerId = g.players[first].id; save(); drawOrder(); // kept if the dialog is closed and reopened
    });
    solEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sol]'); if (!b) return; const p = P(b.dataset.sol); if (!p) return;
      p.solRing = !p.solRing; updatePanel(p); save(); drawOrder();
    });
    drawOrder();
    const turnsIn = ov.querySelector('[data-f=turns]');
    ov.querySelector('.stepper').addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]'); if (!b) return;
      const cur = parseInt(turnsIn.value, 10);
      turnsIn.value = Number.isFinite(cur) ? Math.min(999, Math.max(1, cur + +b.dataset.step)) : typicalTurns();
    });
    ov.querySelector('[data-role=save]').addEventListener('click', () => {
      if (!winner || !G()) return;
      const m = Math.max(1, parseInt(ov.querySelector('[data-f=mins]').value, 10) || mins);
      const tv = parseInt(turnsIn.value, 10); const t = Number.isFinite(tv) && tv > 0 ? Math.min(999, tv) : null;
      closeOverlay(ov); saveGame(winner === 'draw' ? null : winner, m, t, first);
    });
    draw();
  }
  function typicalTurns() {
    const ts = data.games.map((g) => g.turns).filter((t) => t > 0);
    return ts.length ? Math.round(ts.reduce((a, b) => a + b, 0) / ts.length) : 8;
  }
  function saveGame(winnerId, mins, turns, first = 0) {
    const g = G(); const winner = winnerId ? P(winnerId) : null;
    const pos = turnPositions(g.players.length, first);
    const rest = g.players.filter((p) => p !== winner);
    const alive = rest.filter((p) => !p.eliminated); const out = rest.filter((p) => p.eliminated).sort((a, b) => b.elimOrder - a.elimOrder);
    const placeOf = new Map(); if (winner) placeOf.set(winner, 1);
    alive.forEach((p) => placeOf.set(p, winner ? 2 : 1)); // tied: nobody knocked them out
    out.forEach((p, i) => placeOf.set(p, (winner ? 1 : 0) + alive.length + 1 + i));
    const idxOf = (pid) => g.players.findIndex((x) => x.id === pid);
    const rec = {
      id: g.id, startedAt: g.startedAt, endedAt: Date.now(), durationMs: mins * 60000, turns, startingLife: g.startingLife,
      playerCount: g.players.length, winnerIndex: winner ? idxOf(winner.id) : null, firstPlayerIndex: first,
      players: g.players.map((p, i) => ({
        name: p.name, commanderId: p.commanderId, commanderName: p.commanderName, partnerName: p.partnerName, colors: p.colors, seat: p.seat,
        finalLife: p.life, poison: p.poison, maxCmdTaken: Math.max(0, ...Object.values(p.cmd)), casts: p.tax[0] + p.tax[1],
        eliminated: p.eliminated, elimOrder: p.elimOrder, elimReason: p.elimReason,
        killedBy: p.killedBy ? idxOf(p.killedBy) : null, isWinner: p === winner, wentFirst: pos[i] === 1, place: placeOf.get(p),
        turnPos: pos[i], solRingT1: !!p.solRing, // v1.5
        bracket: normBracket(p.bracket), // v1.7: the bracket this player's deck had in this game
        ...(g.groupId ? { kind: p.kind, userId: p.userId || null, guestId: p.guestId || null, deckId: p.deckId || null } : {}),
      })),
    };
    if (g.groupId && cloud && me() && cloud.groups().some((x) => x.id === g.groupId)) {
      rec.id = cloud.uuid(); rec.pendingSync = cloud.offline(); cloud.queueGame(g.groupId, rec);
      data.current = null; save(true); closeGame(); showResult(rec); return;
    }
    data.games.unshift(rec); data.current = null; save(true);
    closeGame(); showResult(rec);
  }
  function showResult(rec) {
    const w = rec.winnerIndex != null ? rec.players[rec.winnerIndex] : null;
    const ov = openSheet(`<div class="dialog-body center"><div class="trophy-big ${w ? '' : 'draw'}">${w ? I.trophy : I.flag}</div>
      <h2>${w ? esc(w.name) + ' wins!' : 'Draw'}</h2>${w && w.commanderName ? `<div class="muted"><span class="pips">${pips(w.colors)}</span> ${esc(w.commanderName)}${w.partnerName ? ' + ' + esc(w.partnerName) : ''}</div>` : ''}
      <div class="muted small">${fmtDur(rec.durationMs)}${rec.turns ? ` · ${rec.turns} turns` : ''} · ${rec.pendingSync ? 'saved — will sync when online' : 'saved to history'}</div>
      <div class="dialog-actions"><button class="btn primary" data-r="rematch">Rematch</button><button class="btn" data-r="stats">View stats</button><button class="btn ghost" data-close>Done</button></div></div>`, { dialog: true });
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return; closeOverlay(ov);
      if (b.dataset.r === 'rematch') startGame(); else setTab('stats');
    });
  }

  // ---------- stats ----------
  function lastPlayedMap() {
    const m = new Map(); allGames().forEach((g) => g.players.forEach((p) => { if (p.commanderId) m.set(p.commanderId, Math.max(m.get(p.commanderId) || 0, g.endedAt)); })); return m;
  }
  function commanderStats() {
    const m = new Map();
    for (const g of allGames()) {
      g.players.forEach((p) => {
        if (!p.commanderId) return;
        let s = m.get(p.commanderId);
        if (!s) { s = { games: 0, wins: 0, dur: 0, turns: 0, last: 0, placeSum: 0, kills: 0, pos: [], posG: 0, solG: 0, sr: { g: 0, w: 0 } }; m.set(p.commanderId, s); }
        s.games++; if (p.isWinner) s.wins++; s.dur += g.durationMs || 0; s.turns += g.turns || 0; s.last = Math.max(s.last, g.endedAt); s.placeSum += p.place || 0;
        if (hasTurnPos(g)) { const x = s.pos[p.turnPos - 1] || (s.pos[p.turnPos - 1] = { g: 0, w: 0 }); x.g++; if (p.isWinner) x.w++; s.posG++; }
        if (hasSolRing(g)) { s.solG++; if (p.solRingT1) { s.sr.g++; if (p.isWinner) s.sr.w++; } }
      });
      g.players.forEach((p) => { if (p.killedBy != null && g.players[p.killedBy]) { const k = m.get(g.players[p.killedBy].commanderId); if (k) k.kills++; } });
    }
    return m;
  }
  // commander / deck detail (v1.5): win rate per turn position (all pod sizes) + turn-1 Sol Ring
  function cmdTurnHtml(s) {
    if (!s || (!s.posG && !s.solG)) return '';
    const cells = Array.from(s.pos, (x, i) => (x && x.g ? `<span class="tp-cell"><small>${ordinal(i + 1)}</small><b>${pct(x.w, x.g)}</b><small>${x.w}/${x.g}</small></span>` : '')).join('');
    return `<div class="cmd-turn">${s.posG ? `<div class="ct-row"><span class="ct-lbl">${I.play}By turn position</span><div class="tp-cells">${cells}</div></div>` : ''}
      ${s.solG ? `<div class="ct-row"><span class="ct-lbl">${I.solring}Turn 1 Sol Ring</span><span class="ct-v"><b>${s.sr.g}</b> of ${s.solG} game${s.solG === 1 ? '' : 's'}${s.sr.g ? ` · won ${s.sr.w} (${pct(s.sr.w, s.sr.g)})` : ''}</span></div>` : ''}
      ${s.posG < s.games || s.solG < s.games ? '<p class="stat-note">Games saved before v1.5 aren’t counted here.</p>' : ''}</div>`;
  }
  // circular win-rate ring for commander/deck cards (text stays "NN%" / "—")
  function wrRing(s) {
    const p = s.games ? Math.round((s.wins / s.games) * 100) : 0;
    return `<div class="cc-wr ${s.games ? '' : 'none'}" style="--p:${p}"><b>${pct(s.wins, s.games)}</b><small>win rate</small></div>`;
  }
  function renderCommanders(v) {
    if (gm()) { renderDecks(v); return; }
    const stats = commanderStats();
    const empty = { games: 0, wins: 0, dur: 0, turns: 0, last: 0, kills: 0 };
    const list = data.commanders.map((c) => ({ c, s: stats.get(c.id) || empty }));
    const wr = (s) => (s.games ? s.wins / s.games : -1);
    const sorters = {
      games: (a, b) => b.s.games - a.s.games || wr(b.s) - wr(a.s) || a.c.name.localeCompare(b.c.name),
      winrate: (a, b) => wr(b.s) - wr(a.s) || b.s.games - a.s.games,
      recent: (a, b) => b.s.last - a.s.last || b.c.createdAt - a.c.createdAt,
      name: (a, b) => a.c.name.localeCompare(b.c.name),
    };
    list.sort(sorters[cmdSort]);
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">${data.commanders.length} deck${data.commanders.length === 1 ? '' : 's'}</div><h1>Commanders</h1></div><button class="btn primary sm" data-act="newCmd">+ Add</button></header>
      ${list.length ? `<div class="seg small-seg">${[['games', 'Most played'], ['winrate', 'Win rate'], ['recent', 'Recent'], ['name', 'A–Z']].map(([k, l]) => `<button data-act="cmdSort" data-v="${k}" class="${cmdSort === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      ${list.length ? list.map(({ c, s }) => `<button class="cmd-card" data-act="editCmd" data-id="${c.id}" style="--deck:${manaGrad(c.colors)}">
          <div class="cc-top"><div class="cc-name"><b>${esc(c.name)}</b>${c.partner ? `<small>+ ${esc(c.partner)}</small>` : ''}<span class="cc-meta"><span class="pips" aria-label="${colorWords(c.colors)}" role="img">${pips(c.colors)}</span>${bchip(c.bracket)}${c.owner ? `<small class="owner">${esc(c.owner)}</small>` : ''}</span></div>
          ${wrRing(s)}</div>
          <div class="cc-stats"><span><b>${s.games}</b> game${s.games === 1 ? '' : 's'}</span><span><b>${s.wins}</b> win${s.wins === 1 ? '' : 's'}</span><span><b>${s.games ? fmtDur(s.dur / s.games) : '—'}</b> avg</span>${s.kills ? `<span><b>${s.kills}</b> cmdr kills</span>` : ''}<span>${s.last ? 'Last ' + fmtShort(s.last) : 'Never played'}</span></div>
        </button>`).join('') : `<div class="empty"><div class="empty-ico">${I.shield}</div><p>No commanders yet.</p><p class="muted small">Add your decks here, or create them when setting up a game.</p><button class="btn primary" data-act="newCmd">Add your first commander</button></div>`}`;
  }
  function statsHead() {
    if (!gm()) return `<header class="page-head"><div><div class="eyebrow">Overview</div><h1>Stats</h1></div></header>`;
    return `<header class="page-head"><div><div class="eyebrow">${esc(cloud.group().name)}</div><h1>Stats</h1></div>${syncPill()}</header>
      <div class="seg small-seg scope-seg"><button data-act="statsScope" data-v="group" class="${statsScope === 'group' ? 'on' : ''}">Group</button><button data-act="statsScope" data-v="me" class="${statsScope === 'me' ? 'on' : ''}">My stats</button></div>`;
  }
  function renderStats(v) {
    const meMode = gm() && statsScope === 'me'; const myId = meMode ? me().id : null;
    const games = meMode ? allGames().filter((g) => g.players.some((p) => p.userId === myId)) : allGames();
    const countP = (p) => !meMode || p.userId === myId;
    if (!games.length) {
      v.innerHTML = groupLoading() ? `${statsHead()}${skeleton('stats')}`
        : `${statsHead()}<div class="empty"><div class="empty-ico">${I.chart}</div><p>No games recorded yet.</p><p class="muted small">Finish a game with “End game & save” to see stats here.</p><button class="btn primary" data-act="goPlay">${I.play}Start a game</button></div>`;
      return;
    }
    const n = games.length;
    const totalDur = games.reduce((a, g) => a + (g.durationMs || 0), 0);
    const turnGames = games.filter((g) => g.turns > 0);
    const totalTurns = turnGames.reduce((a, g) => a + g.turns, 0);
    const totalPlayers = games.reduce((a, g) => a + g.playerCount, 0);
    const byCmd = new Map(); const byPlayer = new Map();
    const colorStats = Object.fromEntries(WUBRG.concat('C').map((c) => [c, { g: 0, w: 0 }]));
    const countStats = [0, 1, 2, 3, 4, 5].map(() => ({ g: 0, w: 0 }));
    const reasons = { commander: 0, life: 0, poison: 0, conceded: 0 };
    let firstGames = 0, firstWins = 0, myGames = 0, myWins = 0;
    games.forEach((g) => {
      g.players.forEach((p) => {
        if (p.commanderName && countP(p)) {
          const label = p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName;
          const k = p.commanderId || 'name:' + label.toLowerCase();
          const live = cmdLookup(p.commanderId);
          const e = byCmd.get(k) || { label: live ? cmdLabel(live) : label, colors: live ? live.colors : p.colors, g: 0, w: 0 };
          e.g++; if (p.isWinner) e.w++; byCmd.set(k, e);
          const colors = live ? live.colors : p.colors || [];
          (colors.length ? colors : ['C']).forEach((c) => { colorStats[c].g++; if (p.isWinner) colorStats[c].w++; });
          countStats[colors.length].g++; if (p.isWinner) countStats[colors.length].w++;
        }
        const pk = pKey(p);
        const pe = byPlayer.get(pk) || { name: pName(p), guest: gm() && !p.userId, g: 0, w: 0, placeSum: 0, cmds: new Map() };
        pe.g++; if (p.isWinner) pe.w++; pe.placeSum += p.place || g.playerCount;
        if (p.commanderName) pe.cmds.set(p.commanderName, (pe.cmds.get(p.commanderName) || 0) + 1);
        byPlayer.set(pk, pe);
        if (p.eliminated && reasons[p.elimReason] != null) reasons[p.elimReason]++;
        if (p.wentFirst) { firstGames++; if (p.isWinner) firstWins++; }
        if (meMode && p.userId === myId) { myGames++; if (p.isWinner) myWins++; }
      });
    });
    const cmds = [...byCmd.values()];
    const most = cmds.slice().sort((a, b) => b.g - a.g || b.w - a.w)[0];
    const minG = cmds.some((c) => c.g >= 3) ? 3 : 1;
    const best = cmds.filter((c) => c.g >= minG).sort((a, b) => b.w / b.g - a.w / a.g || b.g - a.g)[0];
    const longest = games.reduce((a, g) => (g.durationMs > a.durationMs ? g : a), games[0]);
    const shortest = games.reduce((a, g) => (g.durationMs < a.durationMs ? g : a), games[0]);
    const fastest = games.filter((g) => g.winnerIndex != null && g.turns > 0).reduce((a, g) => (!a || g.turns < a.turns ? g : a), null);
    const avgP = totalPlayers / n;
    const base = Math.min(100, Math.round(100 / avgP));
    // win-rate bar; the thin marker shows the "fair share" baseline (1 / avg players)
    const bar = (label, pre, s, cls = '', fill = '') => `<div class="bar-row"><span class="bar-label">${pre}<span class="ellipsis">${label}</span></span><div class="bar ${cls}" style="--base:${base}%${fill ? ';--fill:' + fill : ''}"><i style="width:${s.g ? Math.round((s.w / s.g) * 100) : 0}%"></i></div><span class="bar-val">${pct(s.w, s.g)}<small>${s.w}/${s.g}</small></span></div>`;
    const baseNote = `<div class="bar-note">fair share ≈ ${base}% (1 in ${avgP.toFixed(1)} players)</div>`;
    // commander chart: name on its own line (full width), bar underneath
    const sbar = (label, pre, s2, fill) => `<div class="bar-row stack"><div class="bs-top"><span class="bar-label">${pre}<span class="ellipsis">${label}</span></span><span class="bar-val"><small>${s2.w}/${s2.g}</small>${pct(s2.w, s2.g)}</span></div><div class="bar deck" style="--base:${base}%;--fill:${fill}"><i style="width:${s2.g ? Math.round((s2.w / s2.g) * 100) : 0}%"></i></div></div>`;
    const reasonTotal = Object.values(reasons).reduce((a, b) => a + b, 0);
    const players = [...byPlayer.values()].sort((a, b) => b.g - a.g || b.w - a.w);
    const topPlayer = players.length > 1 ? players.filter((p) => p.w > 0).sort((a, b) => b.w / b.g - a.w / a.g || b.g - a.g)[0] : null;
    const winnerOf = (g) => g.players[g.winnerIndex];
    const extra = turnStatsHtml(games, countP, meMode) + bracketStatsHtml(games, countP, meMode);
    v.innerHTML = `${statsHead()}
      <div class="tiles">
        <div class="tile t-violet"><i class="t-ico">${I.chart}</i><b>${n}</b><span>games played</span></div>
        <div class="tile t-cyan"><i class="t-ico">${I.clock}</i><b>${fmtDur(totalDur / n)}</b><span>avg duration</span></div>
        <div class="tile t-orange"><i class="t-ico">${I.turns}</i><b>${turnGames.length ? (totalTurns / turnGames.length).toFixed(1) : '—'}</b><span>avg turns</span></div>
        <div class="tile t-teal"><i class="t-ico">${I.hourglass}</i><b>${fmtDur(totalDur)}</b><span>total time played</span></div>
        <div class="tile t-rose"><i class="t-ico">${I.users}</i><b>${avgP.toFixed(1)}</b><span>avg players</span></div>
        ${meMode ? `<div class="tile t-gold"><i class="t-ico">${I.trophy}</i><b>${pct(myWins, myGames)}</b><span>your win rate (${myWins}/${myGames})</span></div>` : `<div class="tile t-gold"><i class="t-ico">${I.first}</i><b>${firstGames ? pct(firstWins, firstGames) : '—'}</b><span>first-player win rate</span></div>`}
      </div>
      <div class="card-flow">
      <section class="card"><div class="card-title"><span><span class="ct-ico gold">${I.trophy}</span>Highlights</span></div>
        ${most ? `<div class="hl-row"><span class="muted">Most played</span><span class="hl-v"><span class="pips">${pips(most.colors)}</span> ${esc(most.label)} <small>${most.g} game${most.g === 1 ? '' : 's'}</small></span></div>` : ''}
        ${best ? `<div class="hl-row"><span class="muted">Best win rate${minG > 1 ? ' (3+ games)' : ''}</span><span class="hl-v"><span class="pips">${pips(best.colors)}</span> ${esc(best.label)} <small>${pct(best.w, best.g)}</small></span></div>` : ''}
        ${fastest ? `<div class="hl-row"><span class="muted">Fastest win</span><span class="hl-v">${esc(pName(winnerOf(fastest)))} <small>turn ${fastest.turns} · ${fmtShort(fastest.endedAt)}</small></span></div>` : ''}
        <div class="hl-row"><span class="muted">Longest game</span><span class="hl-v">${fmtDur(longest.durationMs)} <small>${fmtShort(longest.endedAt)}</small></span></div>
        <div class="hl-row"><span class="muted">Shortest game</span><span class="hl-v">${fmtDur(shortest.durationMs)} <small>${fmtShort(shortest.endedAt)}</small></span></div>
      </section>
      <section class="card"><div class="card-title"><span><span class="ct-ico cyan">${I.users}</span>Players</span>${meMode ? '<span class="muted small">in games with you</span>' : ''}</div>
        <div class="ptable"><div class="pt-head"><span>Player</span><span>G</span><span>W</span><span>Win%</span><span>Avg pl.</span></div>
        ${players.map((p) => { const fav = [...p.cmds.entries()].sort((a, b) => b[1] - a[1])[0]; return `<div class="pt-row ${p === topPlayer ? 'top' : ''}"><span class="pt-name"><b>${esc(p.name)}${p.guest ? ' <span class="guest-tag">Guest</span>' : ''}</b>${fav ? `<small>${esc(fav[0])}</small>` : ''}<span class="pt-bar"><i style="width:${Math.round((p.w / p.g) * 100)}%"></i></span></span><span>${p.g}</span><span>${p.w}</span><span class="acc">${pct(p.w, p.g)}</span><span>${(p.placeSum / p.g).toFixed(1)}</span></div>`; }).join('')}</div>
      </section>
      ${extra}
      ${cmds.length ? `<section class="card"><div class="card-title"><span><span class="ct-ico">${I.palette}</span>Win rate by color</span></div>
        ${WUBRG.concat('C').map((c) => bar(COLOR_NAME[c], `<span class="pip pip-${c}"></span>`, colorStats[c], `mana pip-${c}`)).join('')}
        ${baseNote}
      </section>
      <section class="card"><div class="card-title"><span><span class="ct-ico">${I.chart}</span>Win rate by number of colors</span></div>
        ${['Colorless', 'Mono', 'Two-color', 'Three-color', 'Four-color', 'Five-color'].map((l, i) => (countStats[i].g ? bar(l, `<span class="cnt-pips">${i ? '<i></i>'.repeat(i) : '<i class="o"></i>'}</span>`, countStats[i]) : '')).join('')}
        ${baseNote}
      </section>
      <section class="card"><div class="card-title"><span><span class="ct-ico">${I.shield}</span>${meMode ? 'My decks' : 'Commanders'}</span></div>
        ${cmds.sort((a, b) => b.g - a.g || b.w - a.w).map((c) => sbar(esc(c.label), `<span class="pips">${pips(c.colors)}</span>`, c, manaGrad(c.colors, '90deg'))).join('')}
      </section>` : ''}
      ${reasonTotal ? `<section class="card"><div class="card-title"><span><span class="ct-ico rose">${I.skull}</span>How players were eliminated</span></div>
        ${Object.entries(reasons).filter(([, c]) => c).map(([r, c]) => `<div class="bar-row"><span class="bar-label">${REASON[r][0].toUpperCase() + REASON[r].slice(1)}</span><div class="bar alt"><i style="width:${Math.round((c / reasonTotal) * 100)}%"></i></div><span class="bar-val">${c}</span></div>`).join('')}
      </section>` : ''}
      </div>`;
  }
  // ----- v1.5: win rate by turn position + turn-1 Sol Ring. Only games saved with that data count (older ones lack it).
  function turnStatsHtml(games, countP, meMode) {
    let posGames = games.filter(hasTurnPos); const solGames = games.filter(hasSolRing);
    if (!posGames.length && !solGames.length) {
      return `<section class="card new-card"><div class="card-title"><span><span class="ct-ico">${I.play}</span>Turn order &amp; Sol Ring</span></div>
        <p class="muted small">On the End game screen, pick who went first and tick any turn-1 Sol Rings. Win rate by turn position and Sol Ring stats show up here from your next saved game. Games saved before this update aren’t counted.</p></section>`;
    }
    const cmdKey = (p) => { const label = p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName; return p.commanderId || 'name:' + label.toLowerCase(); };
    const cmdInfo = (p) => { const live = cmdLookup(p.commanderId); return { label: live ? cmdLabel(live) : (p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName), colors: live ? live.colors : p.colors || [] }; };
    const note = (k) => (k < games.length ? `<p class="stat-note">Based on ${k} of ${games.length} game${games.length === 1 ? '' : 's'} — games saved before this update aren’t counted.</p>` : '');
    const rate = (s) => (s.g ? Math.round((s.w / s.g) * 100) : 0);
    const pbar = (label, pre, s, base, cls = '') => `<div class="bar-row"><span class="bar-label">${pre}<span class="ellipsis">${label}</span></span><div class="bar ${cls}" style="--base:${base}%"><i style="width:${rate(s)}%"></i></div><span class="bar-val">${pct(s.w, s.g)}<small>${s.w}/${s.g}</small></span></div>`;
    const bySeg = (act, cur) => (meMode ? '' : `<div class="seg small-seg sub-seg">${[['players', 'Players'], ['cmds', 'Commanders']].map(([k, l]) => `<button data-act="${act}" data-v="${k}" class="${cur === k ? 'on' : ''}">${l}</button>`).join('')}</div>`);
    const nameCell = (e) => `<span class="xt-name">${e.pips != null ? `<span class="pips">${pips(e.pips)}</span>` : ''}<span class="ellipsis">${esc(e.label)}${e.guest ? ' <span class="guest-tag">Guest</span>' : ''}</span></span>`;
    let html = '';
    // --- win rate by turn position
    if (posGames.length) {
      // v1.7 bracket filter: games whose whole pod had one bracket (B1..B5) or mixed brackets. Games with a player
      // without a bracket only show under "Any".
      const podOf = (g) => { const pb = podBracket(g.players); return pb && pb.all ? (pb.lo === pb.hi ? pb.lo : 'mixed') : null; };
      const brOpts = [1, 2, 3, 4, 5].filter((b) => posGames.some((g) => podOf(g) === b)).concat(posGames.some((g) => podOf(g) === 'mixed') ? ['mixed'] : []);
      const brSel = brOpts.includes(posBr) ? posBr : 'any';
      const posAll = posGames;
      if (brSel !== 'any') posGames = posGames.filter((g) => podOf(g) === brSel);
      const count = (n) => posGames.filter((g) => g.players.length === n).length;
      const sizes = [...new Set(posGames.map((g) => g.players.length))].sort((a, b) => a - b);
      const defSize = sizes.slice().sort((a, b) => count(b) - count(a) || Math.abs(a - 4) - Math.abs(b - 4))[0];
      const size = posSize === 'all' && sizes.length > 1 ? 'all' : sizes.includes(posSize) ? posSize : defSize;
      const pg = size === 'all' ? posGames : posGames.filter((g) => g.players.length === size);
      const maxPos = size === 'all' ? sizes[sizes.length - 1] : size;
      const blank = () => Array.from({ length: maxPos }, () => ({ g: 0, w: 0 }));
      const all = blank(); const rows = new Map(); const useCmd = meMode || posBy === 'cmds';
      pg.forEach((g) => g.players.forEach((p) => {
        if (!countP(p)) return;
        const c = all[p.turnPos - 1]; c.g++; if (p.isWinner) c.w++;
        if (useCmd && !p.commanderName) return;
        const k = useCmd ? cmdKey(p) : pKey(p);
        let e = rows.get(k);
        if (!e) { const ci = useCmd ? cmdInfo(p) : null; e = { label: ci ? ci.label : pName(p), pips: ci ? ci.colors : null, guest: !useCmd && gm() && !p.userId, pos: blank(), g: 0 }; rows.set(k, e); }
        e.g++; const x = e.pos[p.turnPos - 1]; x.g++; if (p.isWinner) x.w++;
      }));
      const avg = pg.reduce((a, g) => a + g.players.length, 0) / pg.length;
      const base = Math.min(100, Math.round(100 / (size === 'all' ? avg : size)));
      const list = [...rows.values()].sort((a, b) => b.g - a.g).slice(0, 12);
      html += `<section class="card pos-card"><div class="card-title"><span><span class="ct-ico">${I.play}</span>Win rate by turn position</span></div>
        ${brOpts.length ? `<div class="seg small-seg pod-seg br-seg" role="group" aria-label="Bracket"><span class="seg-lbl">Bracket</span><button data-act="posBr" data-v="any" class="${brSel === 'any' ? 'on' : ''}">Any</button>${brOpts.map((b) => `<button data-act="posBr" data-v="${b}" class="${brSel === b ? 'on' : ''}" aria-label="${b === 'mixed' ? 'Mixed brackets' : `Bracket ${b}, ${BR_NAME[b]}`}">${b === 'mixed' ? 'Mixed' : 'B' + b}</button>`).join('')}</div>` : ''}
        ${sizes.length > 1 ? `<div class="seg small-seg pod-seg" role="group" aria-label="Pod size"><span class="seg-lbl">Pod</span>${sizes.map((n) => `<button data-act="posSize" data-v="${n}" class="${size === n ? 'on' : ''}" aria-label="${n} players">${n}p</button>`).join('')}<button data-act="posSize" data-v="all" class="${size === 'all' ? 'on' : ''}">All</button></div>` : `<div class="muted small pod-one">${size}-player games</div>`}
        ${all.map((s, i) => pbar(`${ordinal(i + 1)} to play`, `<span class="pos-badge p${i + 1}">${i + 1}</span>`, s, base, 'pos')).join('')}
        <div class="bar-note">fair share ≈ ${base}%${size === 'all' ? ` (1 in ${avg.toFixed(1)} players)` : ''}</div>
        ${list.length ? `${bySeg('posBy', posBy)}<div class="xtable pos-t" style="--cols:${maxPos}" role="table" aria-label="Win rate by turn position, ${useCmd ? 'per commander' : 'per player'}">
          <div class="xt-head" role="row"><span role="columnheader">${useCmd ? (meMode ? 'My decks' : 'Commander') : 'Player'}</span>${all.map((_, i) => `<span role="columnheader">${ordinal(i + 1)}</span>`).join('')}</div>
          ${list.map((e) => `<div class="xt-row" role="row">${nameCell(e)}${e.pos.map((x) => (x.g ? `<span class="xt-cell" style="--h:${rate(x) / 100}" role="cell" aria-label="${pct(x.w, x.g)}, ${x.w} of ${x.g}"><b>${pct(x.w, x.g)}</b><small>${x.w}/${x.g}</small></span>` : '<span class="xt-cell none" role="cell" aria-label="no games">–</span>')).join('')}</div>`).join('')}
        </div>` : ''}
        ${brSel !== 'any' ? `<p class="stat-note">${posGames.length} game${posGames.length === 1 ? '' : 's'} where ${brSel === 'mixed' ? 'the pod had mixed brackets' : `every player was bracket ${brSel} (${BR_NAME[brSel]})`}.</p>` : ''}
        ${note(posAll.length)}
      </section>`;
    }
    // --- turn-1 Sol Ring
    if (solGames.length) {
      const w = { g: 0, w: 0 }, wo = { g: 0, w: 0 }; let gamesWith = 0, entries = 0;
      const rows = new Map(); const useCmd = meMode || solBy === 'cmds';
      solGames.forEach((g) => {
        let any = false;
        g.players.forEach((p) => {
          if (!countP(p)) return;
          entries++; const t = p.solRingT1 ? w : wo; t.g++; if (p.isWinner) t.w++; if (p.solRingT1) any = true;
          if (useCmd && !p.commanderName) return;
          const k = useCmd ? cmdKey(p) : pKey(p);
          let e = rows.get(k);
          if (!e) { const ci = useCmd ? cmdInfo(p) : null; e = { label: ci ? ci.label : pName(p), pips: ci ? ci.colors : null, guest: !useCmd && gm() && !p.userId, g: 0, sr: { g: 0, w: 0 }, no: { g: 0, w: 0 } }; rows.set(k, e); }
          e.g++; const x = p.solRingT1 ? e.sr : e.no; x.g++; if (p.isWinner) x.w++;
        });
        if (any) gamesWith++;
      });
      const avg = solGames.reduce((a, g) => a + g.players.length, 0) / solGames.length;
      const base = Math.min(100, Math.round(100 / avg));
      const list = [...rows.values()].filter((e) => e.sr.g).sort((a, b) => b.sr.g - a.sr.g || b.g - a.g).slice(0, 12);
      html += `<section class="card sol-card"><div class="card-title"><span><span class="ct-ico sol">${I.solring}</span>Turn 1 Sol Ring</span></div>
        <div class="mini-stats sol-mini">
          <div><b>${pct(gamesWith, solGames.length)}</b><span>${meMode ? 'of your games' : 'of games'}</span></div>
          <div><b>${w.g}</b><span>time${w.g === 1 ? '' : 's'}</span></div>
          ${meMode ? `<div><b>${pct(w.w, w.g)}</b><span>win rate with it</span></div>` : `<div><b>${pct(w.g, entries)}</b><span>of players</span></div>`}
        </div>
        ${w.g ? `${pbar('With T1 Sol Ring', `<span class="sr-ico">${I.solring}</span>`, w, base, 'sol')}${pbar('Without', '<span class="sr-ico off"></span>', wo, base)}
        <div class="bar-note">fair share ≈ ${base}% (1 in ${avg.toFixed(1)} players)</div>
        ${list.length ? `${bySeg('solBy', solBy)}<div class="xtable sol-t" role="table" aria-label="Turn 1 Sol Ring ${useCmd ? 'per commander' : 'per player'}">
          <div class="xt-head" role="row"><span role="columnheader">${useCmd ? (meMode ? 'My decks' : 'Commander') : 'Player'}</span><span role="columnheader">T1 Sol</span><span role="columnheader">Win% with</span><span role="columnheader">without</span></div>
          ${list.map((e) => `<div class="xt-row" role="row">${nameCell(e)}<span class="xt-cell plain" role="cell"><b>${e.sr.g}</b><small>of ${e.g}</small></span><span class="xt-cell" style="--h:${rate(e.sr) / 100}" role="cell"><b>${pct(e.sr.w, e.sr.g)}</b><small>${e.sr.w}/${e.sr.g}</small></span><span class="xt-cell${e.no.g ? '' : ' none'}" style="--h:${rate(e.no) / 100}" role="cell">${e.no.g ? `<b>${pct(e.no.w, e.no.g)}</b><small>${e.no.w}/${e.no.g}</small>` : '–'}</span></div>`).join('')}
        </div>` : ''}` : `<p class="muted small">No turn-1 Sol Rings recorded yet.</p>`}
        ${note(solGames.length)}
      </section>`;
    }
    return html;
  }
  // ----- v1.7: Commander Brackets. Each game stores every player's bracket at that moment; games without any are left out.
  function bracketStatsHtml(games, countP, meMode) {
    const title = `<div class="card-title"><span><span class="ct-ico br">${I.bracket}</span>Brackets</span>${meMode ? '<span class="muted small">your decks</span>' : ''}</div>`;
    const bg = games.filter((g) => g.players.some((p) => normBracket(p.bracket)));
    if (!bg.length) {
      return `<section class="card new-card br-card">${title}
        <p class="muted small">Give your decks a Commander Bracket (1 Exhibition, 2 Core, 3 Upgraded, 4 Optimized, 5 cEDH) on the Commanders tab or at game setup. Win rates by bracket show up here from your next saved game. Games without a bracket aren’t counted.</p></section>`;
    }
    const cmdKey = (p) => { const label = p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName; return p.commanderId || 'name:' + label.toLowerCase(); };
    const cmdInfo = (p) => { const live = cmdLookup(p.commanderId); return { label: live ? cmdLabel(live) : (p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName), colors: live ? live.colors : p.colors || [] }; };
    const rate = (s) => (s.g ? Math.round((s.w / s.g) * 100) : 0);
    const tally = (s, p) => { s.g++; if (p.isWinner) s.w++; };
    const useCmd = meMode || brBy === 'cmds';
    const rowOf = (map, p) => {
      if (useCmd && !p.commanderName) return null;
      const k = useCmd ? cmdKey(p) : pKey(p); let e = map.get(k);
      if (!e) { const ci = useCmd ? cmdInfo(p) : null; e = { label: ci ? ci.label : pName(p), pips: ci ? ci.colors : null, guest: !useCmd && gm() && !p.userId, g: 0, b: [0, 1, 2, 3, 4, 5].map(() => ({ g: 0, w: 0 })), hi: { g: 0, w: 0 }, lo: { g: 0, w: 0 } }; map.set(k, e); }
      return e;
    };
    // 1) win rate by the player's own bracket (every player entry that had one)
    const byB = [0, 1, 2, 3, 4, 5].map(() => ({ g: 0, w: 0 })); const rows = new Map(); let seatsN = 0, seatsSum = 0;
    // 2) the pod: one bracket for everyone vs mixed (only games where every player had a bracket)
    const pods = { uniform: [0, 0, 0, 0, 0, 0], mixed: 0, full: 0 };
    const hi = { g: 0, w: 0 }, lo = { g: 0, w: 0 }; let mixN = 0, mixSeats = 0;
    bg.forEach((g) => {
      const pb = podBracket(g.players);
      if (pb.all) { pods.full++; if (pb.lo === pb.hi) pods.uniform[pb.lo]++; else pods.mixed++; }
      const mixed = pb.all && pb.lo < pb.hi; if (mixed) { mixN++; mixSeats += g.players.length; }
      g.players.forEach((p) => {
        const b = normBracket(p.bracket); if (!b || !countP(p)) return;
        tally(byB[b], p); seatsN++; seatsSum += g.players.length;
        const e = rowOf(rows, p); if (e) { e.g++; tally(e.b[b], p); }
        if (mixed) {
          if (b === pb.hi) { tally(hi, p); if (e) tally(e.hi, p); }
          if (b === pb.lo) { tally(lo, p); if (e) tally(e.lo, p); }
        }
      });
    });
    const present = [1, 2, 3, 4, 5].filter((b) => byB[b].g);
    const base = Math.min(100, Math.round(100 / (seatsSum / Math.max(1, seatsN))));
    const mixBase = mixN ? Math.min(100, Math.round(100 / (mixSeats / mixN))) : base;
    const pbar = (label, pre, st, bs, cls = '') => `<div class="bar-row"><span class="bar-label">${pre}<span class="ellipsis">${label}</span></span><div class="bar ${cls}" style="--base:${bs}%"><i style="width:${rate(st)}%"></i></div><span class="bar-val">${pct(st.w, st.g)}<small>${st.w}/${st.g}</small></span></div>`;
    const nameCell = (e) => `<span class="xt-name">${e.pips != null ? `<span class="pips">${pips(e.pips)}</span>` : ''}<span class="ellipsis">${esc(e.label)}${e.guest ? ' <span class="guest-tag">Guest</span>' : ''}</span></span>`;
    const cell = (x) => (x.g ? `<span class="xt-cell" style="--h:${rate(x) / 100}" role="cell" aria-label="${pct(x.w, x.g)}, ${x.w} of ${x.g}"><b>${pct(x.w, x.g)}</b><small>${x.w}/${x.g}</small></span>` : '<span class="xt-cell none" role="cell" aria-label="no games">–</span>');
    const list = [...rows.values()].filter((e) => e.g).sort((a, b) => b.g - a.g).slice(0, 12);
    const seg = meMode ? '' : `<div class="seg small-seg sub-seg">${[['players', 'Players'], ['cmds', 'Commanders']].map(([k, l]) => `<button data-act="brBy" data-v="${k}" class="${brBy === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const who = useCmd ? (meMode ? 'My decks' : 'Commander') : 'Player';
    const hlList = list.filter((e) => e.hi.g || e.lo.g);
    const podTop = [1, 2, 3, 4, 5].filter((b) => pods.uniform[b]).sort((a, b) => pods.uniform[b] - pods.uniform[a])[0];
    return `<section class="card br-card">${title}
      <div class="mini-stats br-mini">
        <div><b>${bg.length}</b><span>game${bg.length === 1 ? '' : 's'} with brackets</span></div>
        <div><b>${podTop ? 'B' + podTop : '—'}</b><span>${podTop ? `most common pod (${pods.uniform[podTop]})` : 'no single-bracket pods'}</span></div>
        <div><b>${pods.full ? pct(pods.mixed, pods.full) : '—'}</b><span>mixed pods${pods.full ? ` (${pods.mixed}/${pods.full})` : ''}</span></div>
      </div>
      <div class="sec-title">Win rate by bracket</div>
      ${present.map((b) => pbar(BR_NAME[b], `<span class="br-badge b${b}">${b}</span>`, byB[b], base, 'br b' + b)).join('')}
      <div class="bar-note">fair share ≈ ${base}% (1 in ${(seatsSum / Math.max(1, seatsN)).toFixed(1)} players)</div>
      ${list.length ? `${seg}<div class="xtable br-t" style="--cols:${present.length}" role="table" aria-label="Win rate by bracket, ${useCmd ? 'per commander' : 'per player'}">
        <div class="xt-head" role="row"><span role="columnheader">${who}</span>${present.map((b) => `<span role="columnheader" aria-label="Bracket ${b}">B${b}</span>`).join('')}</div>
        ${list.map((e) => `<div class="xt-row" role="row">${nameCell(e)}${present.map((b) => cell(e.b[b])).join('')}</div>`).join('')}
      </div>` : ''}
      <div class="sec-title">Highest / lowest bracket at the table</div>
      ${mixN ? `${pbar('Highest bracket at the table', `<span class="hl-ico up">${I.up}</span>`, hi, mixBase, 'br-hi')}${pbar('Lowest bracket at the table', `<span class="hl-ico down">${I.down}</span>`, lo, mixBase, 'br-lo')}
        <div class="bar-note">${mixN} mixed-bracket game${mixN === 1 ? '' : 's'} · fair share ≈ ${mixBase}%</div>
        ${hlList.length ? `<div class="xtable br-hl" role="table" aria-label="Win rate as highest and lowest bracket, ${useCmd ? 'per commander' : 'per player'}">
          <div class="xt-head" role="row"><span role="columnheader">${who}</span><span role="columnheader">Highest</span><span role="columnheader">Lowest</span></div>
          ${hlList.map((e) => `<div class="xt-row" role="row">${nameCell(e)}${cell(e.hi)}${cell(e.lo)}</div>`).join('')}
        </div>` : ''}` : '<p class="muted small">No mixed-bracket games yet: this needs games where every player had a bracket and they weren’t all the same.</p>'}
      <p class="stat-note">Based on ${bg.length} of ${games.length} game${games.length === 1 ? '' : 's'}${bg.length < games.length ? ' — games without a bracket aren’t counted' : ''}. Highest / lowest uses only mixed-bracket games where every player had a bracket.</p>
    </section>`;
  }
  let histLimit = 50; // History renders in batches ("Show more") so thousands of games stay fast
  function renderHistory(v) {
    const all = allGames(); const games = all.slice(0, histLimit); const more = all.length - games.length; const myId = me() ? me().id : null;
    const recName = (g) => { const m = memberById(g.recordedBy); return m ? m.display_name : ''; };
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">${gm() ? esc(cloud.group().name) + ' · ' : ''}${all.length} game${all.length === 1 ? '' : 's'}</div><h1>History</h1></div>${gm() ? syncPill() : ''}</header>
      ${games.length ? games.map((g) => {
        const ps = g.players.slice().sort((a, b) => (a.place || 99) - (b.place || 99));
        const w = g.winnerIndex != null ? g.players[g.winnerIndex] : null;
        const pb = podBracket(g.players);
        const brMeta = pb ? `<span class="gbr ${pb.lo === pb.hi ? 'b' + pb.lo : 'mixed'}" role="img" aria-label="${pb.lo === pb.hi ? `Bracket ${pb.lo}, ${BR_NAME[pb.lo]}` : `Mixed brackets ${pb.lo} to ${pb.hi}`}${pb.all ? '' : ` (${pb.known} of ${pb.n} players set)`}">${I.bracket}${podLabel(pb)}${pb.lo === pb.hi ? ` <span class="gbr-n">${BR_NAME[pb.lo]}</span>` : ''}${pb.all ? '' : ` <small>${pb.known}/${pb.n}</small>`}</span>` : '';
        return `<div class="card game-card"><div class="gc-head"><div><b class="gc-date">${fmtDate(g.endedAt)}</b> <span class="muted small">${fmtTime(g.startedAt)}</span><div class="gc-meta"><span>${I.users}${g.playerCount} players</span><span>${I.clock}${fmtDur(g.durationMs)}</span>${g.turns ? `<span>${I.turns}${g.turns} turns</span>` : ''}<span>${I.heart}${g.startingLife} life</span>${brMeta}</div>
          ${gm() ? `<div class="muted small">${cloud.isPending(g.id) ? '<span class="pend-badge">⟳ waiting to sync</span> ' : ''}${recName(g) ? 'recorded by ' + esc(recName(g)) : ''}</div>` : ''}</div>
          ${!gm() || g.recordedBy === myId ? `<button class="icon-btn danger" data-act="deleteGame" data-id="${g.id}" aria-label="Delete game">${I.trash}</button>` : ''}</div>
          <div class="gc-winner ${w ? '' : 'draw'}">${w ? `${I.trophy}<b>${esc(pName(w))}</b>${w.commanderName ? `<span class="ellipsis muted"><span class="pips">${pips(w.colors)}</span> ${esc(w.commanderName)}</span>` : ''}` : `${I.flag}<b>Draw</b>`}</div>
          <div class="gc-players">${ps.map((p) => `<div class="gc-p ${p.isWinner ? 'win' : ''}"><span class="gc-place">${p.place ? ordinal(p.place) : ''}</span><span class="ellipsis">${p.seat != null ? `<span class="seat-dot sm seat-${p.seat % 6}"></span>` : ''}<b>${esc(pName(p))}</b>${gm() && !p.userId ? ' <span class="guest-tag">Guest</span>' : ''} ${p.commanderName ? '· ' + esc(p.commanderName) : ''}</span><span class="gc-tail muted small nowrap">${brBadge(p.bracket)}${p.eliminated ? REASON[p.elimReason] : p.finalLife + ' ♥'}${Number.isInteger(p.turnPos) ? `<span class="tp-badge" role="img" aria-label="${ordinal(p.turnPos)} to play" title="${ordinal(p.turnPos)} to play">${I.play}${p.turnPos}</span>` : p.wentFirst ? ' · went 1st' : ''}${p.solRingT1 ? `<span class="sr-badge" role="img" aria-label="Turn 1 Sol Ring" title="Turn 1 Sol Ring">${I.solring}</span>` : ''}</span></div>`).join('')}</div></div>`;
      }).join('') : groupLoading() ? skeleton('history') : `<div class="empty"><div class="empty-ico">${I.history}</div><p>No games yet.</p><p class="muted small">Saved games appear here. You can delete a wrong entry anytime.</p><button class="btn primary" data-act="goPlay">${I.play}Start a game</button></div>`}
      ${more > 0 ? `<button class="btn ghost block more-hist" data-act="moreHistory">Show more <span class="muted">· ${more} older game${more === 1 ? '' : 's'}</span></button>` : ''}`;
  }
  function skeleton(kind) {
    const bar = (w) => `<i class="sk-line" style="width:${w}%"></i>`;
    const card = (n) => `<div class="card sk-card">${bar(38)}${Array.from({ length: n }, (_, i) => bar(90 - i * 14)).join('')}</div>`;
    return `<div class="skeleton" aria-busy="true" aria-live="polite"><span class="sr-only">Loading group games…</span>${kind === 'stats' ? `<div class="tiles">${'<div class="tile sk-tile"></div>'.repeat(6)}</div>${card(4)}${card(3)}` : card(4) + card(4) + card(3)}</div>`;
  }

  // ---------- settings / backup ----------
  function renderSettings(v) {
    const s = data.settings;
    const size = new Blob([localStorage.getItem(STORE_KEY) || '']).size;
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">Commander Tracker ${APP_VERSION}</div><h1>Settings</h1></div></header>
      ${accountSectionHtml()}
      <section class="card"><div class="card-title">Defaults</div>
        <div class="field"><label>Default starting life</label><div class="seg">${LIFE_PRESETS.map((n) => `<button data-act="defLife" data-v="${n}" class="${s.startingLife === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Default players</label><div class="seg">${[2, 3, 4, 5, 6].map((n) => `<button data-act="defCount" data-v="${n}" class="${s.playerCount === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <label class="switch-row"><span>Keep screen awake during games${'wakeLock' in navigator ? '' : ' <small class="muted">(not supported here)</small>'}</span><input type="checkbox" data-bind="wakeLock" ${s.wakeLock ? 'checked' : ''}><i class="switch"></i></label>
        <label class="switch-row"><span>Random first player at start</span><input type="checkbox" data-bind="randomFirst" ${s.randomFirst ? 'checked' : ''}><i class="switch"></i></label>
        <label class="switch-row"><span>Slowly rotate the centre timer <small class="muted">(so every seat can read it)</small></span><input type="checkbox" data-bind="spinClock" ${s.spinClock !== false ? 'checked' : ''}><i class="switch"></i></label>
        <label class="switch-row"><span>Wide game layout on an upright phone <small class="muted">(the game turns sideways so players sit along the long sides; this device)</small></span><input type="checkbox" data-bind="wideLayout" ${forceWide() ? 'checked' : ''}><i class="switch"></i></label>
      </section>
      <section class="card"><div class="card-title">Backup</div>
        <p class="muted small">${gm() ? 'Local (offline) data on this device — group games are stored online. ' : ''}All data is stored only on this device (${data.commanders.length} commanders, ${data.games.length} games, ${(size / 1024).toFixed(1)} KB). Export a backup regularly — e.g. save it to Files or iCloud Drive.</p>
        <div class="row2"><button class="btn primary" data-act="exportData">Export JSON</button><label class="btn">Import JSON<input type="file" accept="application/json,.json" data-bind="importFile" hidden></label></div>
        <button class="btn ghost block" data-act="copyData">Copy backup to clipboard</button>
      </section>
      <section class="card danger-card"><div class="card-title">Danger zone</div><button class="btn danger-outline block" data-act="wipeData">Delete all data</button></section>
      ${installHint()}
      <p class="muted small center foot-note">Tap the top / bottom half of a panel for ±1, hold for ±10. Use ⋯ for commander damage, poison, tax, monarch & initiative. The centre clock opens the game menu.</p>
      <p class="center"><button class="link-btn" data-act="displayInfo">Display info</button></p>`;
  }
  function backupJson() {
    return JSON.stringify({ app: 'commander-tracker', version: 1, exportedAt: new Date().toISOString(), commanders: data.commanders, games: data.games, settings: data.settings, lastSetup: data.lastSetup, current: data.current }, null, 2);
  }
  async function exportData() {
    const json = backupJson(); const name = `commander-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Commander Tracker backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Backup exported');
  }
  async function importFile(file) {
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { toast('Not a valid JSON file'); return; }
    if (!obj || !Array.isArray(obj.games) || !Array.isArray(obj.commanders)) { toast('Not a Commander Tracker backup'); return; }
    const mode = await choiceDialog(`Backup contains <b>${obj.commanders.length}</b> commanders and <b>${obj.games.length}</b> games.`,
      [{ label: 'Merge with current data', value: 'merge', cls: 'primary' }, { label: 'Replace everything', value: 'replace', cls: 'danger' }]);
    if (!mode) return;
    const inc = normalize(obj); const prev = data;
    if (mode === 'replace') { data = inc; }
    else {
      const cids = new Set(data.commanders.map((c) => c.id)); const gids = new Set(data.games.map((g) => g.id));
      data = { ...data, commanders: data.commanders.concat(inc.commanders.filter((c) => !cids.has(c.id))), games: data.games.concat(inc.games.filter((g) => !gids.has(g.id))).sort((a, b) => b.endedAt - a.endedAt) };
    }
    clearTimeout(saveTimer);
    if (!persist()) {
      const mb = (JSON.stringify(data).length / 1048576).toFixed(1); data = prev;
      await alertDialog(`<b>This backup is too big to store on this device</b> (${mb} MB; browsers keep about 5 MB per app). Nothing was changed.`);
      return;
    }
    renderTab(); toast(mode === 'replace' ? 'Data replaced from backup' : 'Backup merged');
  }

  // ---------- wake lock ----------
  let wakeLock = null;
  async function requestWakeLock() {
    if (!data.settings.wakeLock || !('wakeLock' in navigator) || $('#game').hidden || document.hidden || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

  // ---------- online playgroups (UI on top of cloud.js) ----------
  const cloud = window.EDHCloud && window.EDHCloud.available ? window.EDHCloud : null;
  const me = () => (cloud ? cloud.user() : null);
  const gm = () => !!(cloud && cloud.user() && cloud.groupId()); // group mode
  const cd = () => cloud.data();
  const PROFILE_COLORS = ['#ff6b61', '#ffbe4d', '#4fd08a', '#3fd6d0', '#5ea8ff', '#8b6cff', '#e06bb0', '#c9ced9'];
  function allGames() { return gm() ? cd().games : data.games; }
  const groupLoading = () => gm() && !cd().fetchedAt && !cloud.offline(); // joined, first download still running
  function memberById(id) { return gm() && id ? cd().members.find((m) => m.id === id) || null : null; }
  function deckById(id) { return gm() && id ? cd().decks.find((d) => d.id === id) || null : null; }
  // commander info by id: group deck (online) or local commander
  function cmdLookup(id) {
    const d = deckById(id); if (d) return { name: d.commander, partner: d.partner || '', colors: d.colors || [], deckName: d.name || '', ownerId: d.owner_id, bracket: normBracket(d.bracket) };
    return getCmd(id);
  }
  function pName(p) { const m = memberById(p.userId); return m ? m.display_name : p.name; }
  function pKey(p) { return p.userId ? 'u:' + p.userId : 'n:' + String(p.name || '').trim().toLowerCase(); }
  const deckLabel = (d) => (d.partner ? `${d.commander} + ${d.partner}` : d.commander);
  function syncPill() {
    if (!cloud || !me()) return '';
    const n = cloud.pending();
    if (cloud.offline()) return `<span class="sync-pill off">● Offline${n ? ` · ${n} pending` : ''}</span>`;
    return n ? `<button class="sync-pill" data-act="syncNow">⟳ ${n} pending sync</button>` : '';
  }
  function dot(color, cls = '') { return `<span class="p-dot ${cls}" style="background:${esc(color || '#8b93ab')}"></span>`; }

  let renderQueued = false;
  function requestRender() {
    if (!$('#game').hidden) return; // never disturb a running game
    const ae = document.activeElement;
    if ($('.overlay') || (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) { renderQueued = true; return; }
    renderQueued = false; renderTab();
  }
  if (cloud) cloud.on(requestRender);
  window.addEventListener('online', requestRender);
  window.addEventListener('offline', requestRender);

  // ----- auth -----
  const G_LOGO = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
  async function startGoogle(errEl) {
    try { await cloud.signInWithGoogle(); } // navigates away (same window) on success
    catch (ex) { if (errEl) errEl.textContent = ex.message; else toast(ex.message); }
  }
  // mode: 'google' (default: Google first, username/password collapsed), 'signin' or 'signup' (classic form open)
  function openAuth(mode = 'google', opts = {}) {
    if (!cloud) { toast('Online features need a connection the first time — try again when online.'); return; }
    let color = PROFILE_COLORS[rand(PROFILE_COLORS.length)];
    const classicOpen = mode !== 'google'; if (!classicOpen) mode = 'signin';
    const ov = openSheet(`<div class="sheet-head"><h2>Sign in</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        ${opts.note ? `<div class="note-card">${opts.note}</div>` : ''}
        <button class="btn google-btn big block" data-role="google">${G_LOGO}<span>Continue with Google</span></button>
        <p class="muted small center">Your Google name becomes your display name (you can change it). Only your name and email are used.</p>
        <div class="form-error center" data-role="gerr"></div>
        <button class="link-btn more-btn" data-role="more" ${classicOpen ? 'hidden' : ''}>Other options: username & password</button>
        <div data-role="classic" ${classicOpen ? '' : 'hidden'}>
        <div class="or-sep"><span>or</span></div>
        <div class="seg auth-seg"><button data-mode="signin">Sign in</button><button data-mode="signup">Create account</button></div>
        <form data-role="form" autocomplete="on">
          <div class="field"><label data-role="ulabel">Username</label><input type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="80" placeholder="e.g. daniele" required></div>
          <div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password" minlength="6" maxlength="72" placeholder="At least 6 characters" required></div>
          <div class="signup-only">
            <div class="field"><label>Display name <span class="muted">(shown to your group)</span></label><input type="text" name="display" maxlength="24" autocapitalize="words" placeholder="e.g. Daniele"></div>
            <div class="field"><label>Color</label><div class="swatches">${PROFILE_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div>
            <p class="muted small">No email needed. Usernames are lowercase letters, numbers or _. There's no password reset, so pick one you'll remember.</p>
          </div>
          <div class="form-error" data-role="err"></div>
          <button class="btn primary big block" type="submit" data-role="submit"></button>
        </form>
        </div>
      </div>`, { cls: classicOpen ? 'tall' : '' });
    const form = ov.querySelector('[data-role=form]');
    const setMode = (m) => {
      mode = m;
      ov.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
      ov.querySelector('.signup-only').hidden = m !== 'signup';
      ov.querySelector('[data-role=ulabel]').textContent = m === 'signup' ? 'Username' : 'Username (or email, if you set an app password)';
      ov.querySelector('[data-role=submit]').textContent = m === 'signup' ? 'Create account' : 'Sign in';
      form.password.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
      ov.querySelector('[data-role=err]').textContent = '';
    };
    const paintSwatches = () => ov.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === color));
    ov.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
      if (e.target.closest('[data-role=google]')) { startGoogle(ov.querySelector('[data-role=gerr]')); return; }
      if (e.target.closest('[data-role=more]')) { ov.querySelector('[data-role=classic]').hidden = false; e.target.closest('[data-role=more]').hidden = true; return; }
      const s = e.target.closest('.swatch'); if (s) { color = s.dataset.color; paintSwatches(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = ov.querySelector('[data-role=err]'); const btn = ov.querySelector('[data-role=submit]');
      err.textContent = ''; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Please wait…';
      try {
        const u = form.username.value.trim().toLowerCase(); const pw = form.password.value;
        if (mode === 'signup') {
          const r = await cloud.signUp(u, pw, form.display.value.trim() || u, color);
          if (r.needsConfirmation) {
            err.innerHTML = 'Account created, but the server still requires <b>email confirmation</b>, so you can\'t sign in yet. The group admin needs to turn off “Confirm email” in the Supabase dashboard.';
            return;
          }
        } else {
          await cloud.signIn(u, pw);
        }
        closeOverlay(ov); toast(`Signed in as ${me().display_name}`);
        renderTab();
        if (opts.onDone) opts.onDone(); else afterSignIn();
      } catch (ex) { err.textContent = ex.message || String(ex); } finally { btn.disabled = false; btn.textContent = label; }
    });
    setMode(mode); paintSwatches();
  }
  // A Google redirect arrived in an app instance that didn't start it (no PKCE verifier here). On iPhone this happens
  // when the sign-in finished in Safari instead of the Home Screen app (they don't share storage), or the reverse.
  function oauthWrongPlace() {
    const inSafari = isIOS && !isStandalone();
    const ov = openSheet(`<div class="sheet-head"><h2>Almost there</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        <p>Google sign-in finished ${inSafari ? 'in Safari instead of the Home Screen app' : 'in a different window than the one that started it'}, so it couldn't be completed here.</p>
        <div class="note-card"><b>Fix:</b> ${inSafari ? 'close Safari, open Commander Tracker from your Home Screen and tap <b>Continue with Google</b> again.' : 'tap Continue with Google again in this window.'}
        If it keeps happening: sign in with Google here, open Settings → <b>Set an app password</b>, then in the Home Screen app use <b>Other options</b> and sign in with your Google email + that password.</div>
        <button class="btn google-btn big block" data-a="google">${G_LOGO}<span>Continue with Google here</span></button>
        <div class="form-error center" data-role="gerr"></div>
      </div>`);
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-a=google]')) startGoogle(ov.querySelector('[data-role=gerr]')); });
  }
  function afterSignIn(isNew) {
    if (pendingJoinCode()) { handlePendingJoin(); return; }
    if (!cloud.groups().length) { setTab('settings'); toast('Create a playgroup or join one with an invite code'); if (isNew) setTimeout(() => editProfile('Welcome! This is how your group will see you.'), 500); return; }
    maybeOfferMigration();
  }


  // ----- login screen -----
  const LOCAL_KEY = 'edh-tracker:localOnly'; // user chose "Play without an account": don't show the login on launch
  let freshInvite = false; // opened via ?join= in this launch (shows the login even after a local-only choice)
  const loginEl = $('#login');
  const loginVisible = () => !loginEl.hidden;
  function shouldShowLogin() { return !me() && !data.current && (!localStorage.getItem(LOCAL_KEY) || freshInvite); }
  function showLogin(opts = {}) {
    loginEl.querySelector('[data-login=google]').innerHTML = `${G_LOGO}<span>Continue with Google</span>`;
    loginEl.querySelector('.login-actions').hidden = !!opts.busy;
    loginEl.querySelector('.login-busy').hidden = !opts.busy;
    loginEl.querySelector('[data-role=lerr]').textContent = opts.error || '';
    const inv = loginEl.querySelector('.login-invite'); const code = pendingJoinCode();
    inv.hidden = !code;
    if (code) {
      inv.innerHTML = `You've been invited to <b data-role="gname">a playgroup</b><small>Sign in to join · code ${esc(code)}</small>`;
      if (cloud) cloud.invitePreview(code).then((name) => { const b = inv.querySelector('[data-role=gname]'); if (name && b) b.textContent = name; });
    }
    loginEl.hidden = false; document.body.classList.add('login-open');
  }
  function hideLogin() { if (loginEl.hidden) return; loginEl.hidden = true; document.body.classList.remove('login-open'); }
  loginEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-login]'); if (!b) return;
    const err = loginEl.querySelector('[data-role=lerr]'); err.textContent = '';
    if (b.dataset.login === 'google') {
      if (!cloud) { err.textContent = 'You are offline — connect to sign in, or play without an account.'; return; }
      startGoogle(err);
    } else if (b.dataset.login === 'other') openAuth('signin');
    else if (b.dataset.login === 'local') {
      localStorage.setItem(LOCAL_KEY, '1'); freshInvite = false; hideLogin();
      if (pendingJoinCode()) toast(`Invite saved — join anytime in Settings (code ${pendingJoinCode()})`);
    }
  });
  let hadUser = !!me();
  if (cloud) cloud.on(() => {
    const u = !!me();
    if (u) { localStorage.removeItem(LOCAL_KEY); hideLogin(); }
    else if (hadUser && shouldShowLogin()) showLogin(); // just signed out
    hadUser = u;
  });

  // ----- invite links (?join=CODE) -----
  const JOIN_KEY = 'edh-tracker:pendingJoin';
  const pendingJoinCode = () => localStorage.getItem(JOIN_KEY);
  function captureJoinParam() {
    const q = new URLSearchParams(location.search); const code = (q.get('join') || '').trim().toUpperCase();
    if (!code) return;
    if (/^[A-Z0-9]{8}$/.test(code)) { localStorage.setItem(JOIN_KEY, code); freshInvite = true; }
    q.delete('join'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  }
  function inviteLink(code) { return `${location.origin}${location.pathname}?join=${code}`; }
  async function handlePendingJoin() {
    const code = pendingJoinCode(); if (!code) return;
    if (!cloud) { toast('Open the app online to join the playgroup'); return; }
    if (!me()) {
      const ov = openSheet(`<div class="sheet-head"><h2>You're invited!</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
        <div class="sheet-body"><p>Join the playgroup with invite code</p><div class="invite-code">${code}</div>
        ${isIOS && !isStandalone() ? '<div class="note-card"><b>Tip:</b> first add this app to your Home Screen (Share → Add to Home Screen), open it from there, sign in with Google and enter this code in Settings → Join with code. The Home Screen app keeps its own sign-in, separate from Safari.</div>' : ''}
        <button class="btn google-btn big block" data-a="google">${G_LOGO}<span>Continue with Google & join</span></button>
        <div class="form-error center" data-role="gerr"></div>
        <button class="btn block" data-a="signin">Other sign-in options</button>
        <button class="btn ghost block" data-a="copy">Copy code</button></div>`, { cls: 'tall' });
      ov.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'copy') { try { await navigator.clipboard.writeText(code); toast('Code copied'); } catch (x) { toast(code); } return; }
        if (a.dataset.a === 'google') { startGoogle(ov.querySelector('[data-role=gerr]')); return; } // join resumes after the redirect
        closeOverlay(ov); openAuth(a.dataset.a, { onDone: () => handlePendingJoin() });
      });
      return;
    }
    if (!(await confirmDialog(`Join the playgroup with code <b>${esc(code)}</b>?`, 'Join'))) { localStorage.removeItem(JOIN_KEY); return; }
    try {
      const g = await cloud.joinGroup(code); localStorage.removeItem(JOIN_KEY);
      toast(`Joined ${g.name}`); renderTab(); maybeOfferMigration();
    } catch (e) { toast(e.message); if (/not found/i.test(e.message)) localStorage.removeItem(JOIN_KEY); }
  }

  // ----- settings: account + playgroup -----
  function accountSectionHtml() {
    if (!cloud) return `<section class="card"><div class="card-title">Playgroup</div><p class="muted small">Online features load when you're connected. Everything else works offline.</p></section>`;
    const u = me();
    if (!u) {
      return `<section class="card account-card"><div class="card-title">Playgroup (online)</div>
        <p class="muted small">Sign in so your friends can load their decks, and games & stats are shared with your playgroup. Without an account the app keeps working locally on this phone.</p>
        <button class="btn google-btn block" data-act="authGoogle">${G_LOGO}<span>Continue with Google</span></button>
        <button class="link-btn more-btn" data-act="authOther">Other options: username & password</button>
        ${pendingJoinCode() ? `<p class="small">Pending invite: <b>${esc(pendingJoinCode())}</b></p>` : ''}</section>`;
    }
    const groups = cloud.groups(); const g = cloud.group(); const pend = cloud.pending();
    return `<section class="card account-card"><div class="card-title">Account</div>
        <div class="acct-row">${dot(u.color, 'lg')}<div class="grow"><b>${esc(u.display_name)}</b><div class="muted small">${u.email ? `Google · ${esc(u.email)}` : '@' + esc(u.username)}</div></div><button class="btn sm" data-act="editProfile">Edit</button></div>
        <div class="sync-row"><span class="muted small">${pend ? `${pend} game${pend === 1 ? '' : 's'} waiting to upload` : cloud.lastSync() ? 'All games synced' : 'Synced'}${cloud.lastError() ? ` · <span class="err-text">${esc(cloud.lastError())}</span>` : ''}</span>
        <button class="btn sm ghost" data-act="syncNow">Sync now</button></div>
        ${u.providers && u.providers.includes('google') ? '<button class="link-btn more-btn" data-act="setPassword">Set an app password (backup sign-in with your email)</button>' : ''}
        <button class="btn ghost block danger-text" data-act="signOut">Sign out</button>
      </section>
      <section class="card"><div class="card-title">Playgroup</div>
        ${groups.length > 1 ? `<div class="field"><label>Current group</label><select class="select" data-bind="groupSel">${groups.map((x) => `<option value="${x.id}" ${x.id === cloud.groupId() ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
        ${g ? `<div class="group-name">${esc(g.name)} <span class="muted small">· ${cd().members.length} member${cd().members.length === 1 ? '' : 's'}${g.role === 'owner' ? ' · you created it' : ''}</span></div>
          <div class="muted small">Invite code</div><div class="invite-code">${esc(g.invite_code)}</div>
          <div class="row2"><button class="btn primary" data-act="shareInvite">Share invite link</button><button class="btn" data-act="copyCode">Copy code</button></div>
          <div class="member-list">${cd().members.map((m) => `<div class="member">${dot(m.color)}<span>${esc(m.display_name)}</span><span class="muted small">@${esc(m.username)}${m.role === 'owner' ? ' · owner' : ''}</span></div>`).join('')}</div>`
        : '<p class="muted small">You are not in a playgroup yet. Create one and share the invite code with your friends, or join a friend\'s group.</p>'}
        <div class="row2"><button class="btn" data-act="createGroup">Create group</button><button class="btn" data-act="joinGroupPrompt">Join with code</button></div>
        ${g && (data.commanders.length || data.games.length) ? '<button class="btn ghost block" data-act="migrate">Upload local data to this group</button>' : ''}
        ${g ? '<button class="btn ghost block danger-text" data-act="leaveGroup">Leave group</button>' : ''}
      </section>`;
  }
  function promptText(title, label, value = '', opts = {}) {
    return new Promise((resolve) => {
      let result = null;
      const ov = openSheet(`<div class="dialog-body"><h2>${esc(title)}</h2><div class="field"><label>${esc(label)}</label>
        <input type="${opts.type || 'text'}" data-role="in" value="${esc(value)}" maxlength="${opts.max || 40}" ${opts.upper ? 'autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.15em"' : 'autocapitalize="words"'} autocomplete="off"></div>
        <div class="dialog-actions"><button class="btn primary" data-role="ok">${esc(opts.ok || 'OK')}</button><button class="btn ghost" data-close>Cancel</button></div></div>`, { dialog: true, onClose: () => resolve(result) });
      const inp = ov.querySelector('[data-role=in]');
      const done = () => { result = inp.value.trim(); if (result) closeOverlay(ov); };
      ov.querySelector('[data-role=ok]').addEventListener('click', done);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      setTimeout(() => inp.focus(), 250);
    });
  }
  function editProfile(intro) {
    const u = me(); let color = u.color || PROFILE_COLORS[0];
    const ov = openSheet(`<div class="dialog-body"><h2>Your profile</h2>${intro ? `<p class="muted small">${esc(intro)}</p>` : ''}
      <div class="field"><label>Display name</label><input type="text" data-role="dn" value="${esc(u.display_name)}" maxlength="24"></div>
      <div class="field"><label>Color</label><div class="swatches">${PROFILE_COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="dialog-actions"><button class="btn primary" data-role="ok">Save</button><button class="btn ghost" data-close>Cancel</button></div></div>`, { dialog: true });
    const paint = () => ov.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === color));
    ov.addEventListener('click', async (e) => {
      const s = e.target.closest('.swatch'); if (s) { color = s.dataset.color; paint(); return; }
      const ok = e.target.closest('[data-role=ok]'); if (!ok || ok.disabled) return;
      ok.disabled = true;
      try { await cloud.updateProfile({ display_name: ov.querySelector('[data-role=dn]').value, color }); closeOverlay(ov); toast('Profile saved'); renderTab(); } catch (x) { ok.disabled = false; toast(x.message); }
    });
    paint();
  }

  // ----- local data → group migration -----
  function maybeOfferMigration() {
    const gid = cloud && cloud.groupId();
    if (!gid || cloud.isMigrated(gid) || (!data.commanders.length && !data.games.length)) return;
    setTimeout(() => openMigration(gid), 400);
  }
  function openMigration(gid) {
    const u = me(); const members = cd().members;
    const names = new Map();
    data.games.forEach((g) => g.players.forEach((p) => { const k = p.name.trim().toLowerCase(); if (k && !names.has(k)) names.set(k, p.name.trim()); }));
    data.commanders.forEach((c) => { const k = (c.owner || '').trim().toLowerCase(); if (k && !names.has(k)) names.set(k, c.owner.trim()); });
    const guess = (k) => {
      if (k === u.username || k === u.display_name.toLowerCase()) return 'me';
      const m = members.find((x) => x.id !== u.id && (x.username === k || x.display_name.toLowerCase() === k));
      return m ? 'u:' + m.id : 'guest';
    };
    const map = {}; names.forEach((_, k) => { map[k] = guess(k); });
    const ov = openSheet(`<div class="sheet-head"><h2>Upload local data</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        <p class="muted small">Copy what's on this phone into <b>${esc(cloud.group().name)}</b>. Your local data stays on the phone as it is.</p>
        <label class="check-row"><input type="checkbox" data-role="decks" checked><span>Add my local commanders as my decks <b data-role="nd"></b></span></label>
        <label class="check-row"><input type="checkbox" data-role="games" ${data.games.length ? 'checked' : 'disabled'}><span>Upload ${data.games.length} local game${data.games.length === 1 ? '' : 's'} to the group</span></label>
        ${names.size ? `<div class="sec-title">Who is who?</div><p class="muted small">Match the names used on this phone to group members. Everyone else is saved as a guest.</p>
        ${[...names].map(([k, n]) => `<div class="map-row"><span class="grow ellipsis"><b>${esc(n)}</b></span><select class="select sm" data-name="${esc(k)}">
          <option value="me" ${map[k] === 'me' ? 'selected' : ''}>Me (${esc(u.display_name)})</option>
          ${members.filter((m) => m.id !== u.id).map((m) => `<option value="u:${m.id}" ${map[k] === 'u:' + m.id ? 'selected' : ''}>${esc(m.display_name)}</option>`).join('')}
          <option value="guest" ${map[k] === 'guest' ? 'selected' : ''}>Guest “${esc(n)}”</option></select></div>`).join('')}` : ''}
        <div class="sheet-actions"><button class="btn ghost" data-a="never">Don't ask again</button><button class="btn primary grow" data-a="go">Upload</button></div>
      </div>`, { cls: 'tall' });
    const mine = () => data.commanders.filter((c) => !c.owner.trim() || map[c.owner.trim().toLowerCase()] === 'me');
    const paintCount = () => { ov.querySelector('[data-role=nd]').textContent = `(${mine().length})`; };
    ov.addEventListener('change', (e) => { const s = e.target.closest('select[data-name]'); if (s) { map[s.dataset.name] = s.value; paintCount(); } });
    ov.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'never') { cloud.markMigrated(gid); closeOverlay(ov); return; }
      a.disabled = true; a.textContent = 'Uploading…';
      try {
        const deckMap = {};
        if (ov.querySelector('[data-role=decks]').checked) {
          if (!cloud.online()) throw new Error('Connect to the internet to upload decks.');
          const existing = cd().decks.filter((d) => d.owner_id === u.id);
          for (const c of mine()) {
            const same = existing.find((d) => d.commander.toLowerCase() === c.name.toLowerCase() && (d.partner || '').toLowerCase() === (c.partner || '').toLowerCase());
            deckMap[c.id] = same ? same.id : (await cloud.saveDeck({ commander: c.name, partner: c.partner, colors: c.colors, bracket: normBracket(c.bracket), ...(cleanLink(c.link) ? { link: c.link } : {}) })).id;
          }
        }
        let n = 0;
        if (ov.querySelector('[data-role=games]').checked) {
          [...data.games].reverse().forEach((g) => {
            const players = g.players.map((p) => {
              const who = map[p.name.trim().toLowerCase()] || 'guest';
              const base = { ...p };
              if (who === 'me') return { ...base, kind: 'member', userId: u.id, name: u.display_name, deckId: deckMap[p.commanderId] || null, commanderId: deckMap[p.commanderId] || null };
              if (who.startsWith('u:')) { const m = members.find((x) => 'u:' + x.id === who); return { ...base, kind: 'member', userId: m.id, name: m.display_name, deckId: null, commanderId: null }; }
              return { ...base, kind: 'guest', guestId: null, deckId: null, commanderId: null };
            });
            cloud.queueGame(gid, { ...g, id: cloud.uuid(), players }); n++;
          });
        }
        cloud.markMigrated(gid); closeOverlay(ov);
        toast(`Uploaded ${Object.keys(deckMap).length} deck${Object.keys(deckMap).length === 1 ? '' : 's'}${n ? ` and queued ${n} game${n === 1 ? '' : 's'}` : ''}`);
        renderTab();
      } catch (x) { toast(x.message || String(x)); a.disabled = false; a.textContent = 'Upload'; }
    });
    paintCount();
  }

  // ----- group game setup -----
  function groupSeats() {
    const gid = cloud.groupId();
    data.groupSetups = data.groupSetups || {};
    const seats = data.groupSetups[gid] || (data.groupSetups[gid] = []);
    while (seats.length < 6) seats.push({ kind: null });
    return seats;
  }
  function knownGuests() {
    const map = new Map();
    cd().guests.forEach((g) => map.set(g.name.trim().toLowerCase(), { name: g.name, id: g.id }));
    cd().games.forEach((g) => g.players.forEach((p) => { if (p.kind === 'guest') { const k = p.name.trim().toLowerCase(); if (!map.has(k)) map.set(k, { name: p.name, id: p.guestId || null }); } }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function guestCommanders(name) {
    const k = String(name || '').trim().toLowerCase(); const out = new Map();
    cd().games.forEach((g) => g.players.forEach((p) => {
      if (p.kind === 'guest' && p.name.trim().toLowerCase() === k && p.commanderName) {
        const key = (p.commanderName + '|' + (p.partnerName || '')).toLowerCase();
        if (!out.has(key)) out.set(key, { name: p.commanderName, partner: p.partnerName || '', colors: p.colors || [], bracket: normBracket(p.bracket) });
      }
    }));
    return [...out.values()];
  }
  function allKnownCommanders() {
    const out = new Map();
    const add = (name, partner, colors) => { const key = (name + '|' + (partner || '')).toLowerCase(); if (name && !out.has(key)) out.set(key, { name, partner: partner || '', colors: colors || [] }); };
    cd().decks.forEach((d) => add(d.commander, d.partner, d.colors));
    cd().games.forEach((g) => g.players.forEach((p) => add(p.commanderName, p.partnerName, p.colors)));
    data.commanders.forEach((c) => add(c.name, c.partner, c.colors));
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function seatSummary(seat) {
    if (seat.kind === 'member') {
      const m = memberById(seat.userId); const d = deckById(seat.deckId);
      return { player: m ? `${dot(m.color)}<span class="ellipsis">${esc(m.display_name)}</span>` : '', deck: d ? `<span class="pips">${pips(d.colors)}</span><span class="ellipsis">${esc(deckLabel(d))}</span>` : '', what: d ? deckLabel(d) : '', bracket: d ? seatBracket(seat) : null };
    }
    if (seat.kind === 'guest') {
      const c = seat.commander;
      return { player: `<span class="guest-tag">Guest</span><span class="ellipsis">${esc(seat.name)}</span>`, deck: c && c.name ? `<span class="pips">${pips(c.colors)}</span><span class="ellipsis">${esc(c.partner ? `${c.name} + ${c.partner}` : c.name)}</span>` : '', what: c && c.name ? c.name : '', bracket: c && c.name ? normBracket(c.bracket) : null };
    }
    return { player: '', deck: '' };
  }
  // group seat bracket: a per-seat override (someone else's deck, or offline) wins over the deck's own bracket
  function seatBracket(seat) {
    if (seat.kind === 'member') { const d = deckById(seat.deckId); return normBracket(seat.bracket) || (d ? normBracket(d.bracket) : null); }
    if (seat.kind === 'guest') return seat.commander ? normBracket(seat.commander.bracket) : null;
    return null;
  }
  function openGroupSeatBracket(i) {
    const seat = groupSeats()[i]; const sum = seatSummary(seat); if (!sum.what) return;
    const d = seat.kind === 'member' ? deckById(seat.deckId) : null; const own = d && d.owner_id === me().id;
    const owner = d ? memberById(d.owner_id) : null;
    const where = seat.kind === 'guest' ? `Saved with ${esc(seat.name)}'s commander and remembered for their next games.`
      : own ? 'Saved on your deck for the whole group (needs a connection; offline it applies to the next game only).'
        : `Applies to the next game only. ${esc(owner ? owner.display_name : 'The owner')} sets the deck's own bracket in their app${d && normBracket(d.bracket) ? ` (currently ${d.bracket} · ${BR_NAME[d.bracket]})` : ''}.`;
    const ov = openSheet(`<div class="sheet-head"><div><h2>Bracket</h2><div class="muted small ellipsis">${sum.deck}</div></div><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">${bracketPicker(seatBracket(seat))}<p class="hint">${where}</p><button class="btn primary block" data-close>Done</button></div>`, { onClose: () => renderTab() });
    let busy = false;
    bindBracketPicker(ov, () => seatBracket(seat), (v) => {
      if (busy) return false;
      if (seat.kind === 'guest') { seat.commander = { ...seat.commander, bracket: v }; save(); return true; }
      if (own && cloud.online()) {
        busy = true; delete seat.bracket; save();
        cloud.saveDeck({ id: d.id, commander: d.commander, partner: d.partner || '', name: d.name || '', colors: d.colors || [], bracket: v })
          .then(() => toast('Deck bracket saved'), (x) => { seat.bracket = v; save(); toast(`${x.message} Using it for the next game only.`); })
          .finally(() => { busy = false; });
        return true;
      }
      if (v == null) delete seat.bracket; else seat.bracket = v; save(); return true;
    });
  }
  function renderGroupPlay(v) {
    const s = getSetup(); const seats = groupSeats(); const g = data.current; const grp = cloud.group();
    v.innerHTML = `
    <header class="page-head"><div><div class="eyebrow">${esc(grp ? grp.name : 'Playgroup')}</div><h1>New game</h1></div>${syncPill()}</header>
    ${g ? `<div class="card resume"><div><b>Game in progress</b><div class="muted small">${g.players.length} players · started ${fmtTime(g.startedAt)}</div></div>
      <div class="row"><button class="btn ghost sm" data-act="discardGame">Discard</button><button class="btn primary sm" data-act="resumeGame">Resume</button></div></div>` : ''}
    <section class="card">
      <div class="field"><label>Players</label><div class="seg">${[2, 3, 4, 5, 6].map((n) => `<button data-act="setCount" data-v="${n}" class="${s.count === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Starting life</label><div class="seg" id="life-seg">${LIFE_PRESETS.map((n) => `<button data-act="setLife" data-v="${n}" class="${s.life === n ? 'on' : ''}">${n}</button>`).join('')}
        <input class="seg-input ${LIFE_PRESETS.includes(s.life) ? '' : 'on'}" type="number" inputmode="numeric" min="1" max="999" placeholder="Other" aria-label="Other starting life" value="${LIFE_PRESETS.includes(s.life) ? '' : s.life}" data-bind="customLife"></div></div>
      <label class="switch-row"><span>Random first player</span><input type="checkbox" data-bind="randomFirst" ${data.settings.randomFirst ? 'checked' : ''}><i class="switch"></i></label>
    </section>
    <section class="card">
      <div class="card-title">Seats <span class="muted small">members or guests, clockwise</span></div>
      ${setupPreviewHtml()}
      ${seats.slice(0, s.count).map((seat, i) => {
        const sum = seatSummary(seat);
        return `<div class="seat-row group-seat" data-seat="${i}"><span class="seat-dot seat-${i}">${i + 1}</span>
          <div class="seat-fields">
            <button class="cmd-pick ${sum.player ? '' : 'empty'}" data-act="pickSeatPlayer" data-i="${i}">${sum.player || '<span>Choose player…</span>'}</button>
            <div class="cmd-line"><button class="cmd-pick ${sum.deck ? '' : 'empty'}" data-act="pickSeatDeck" data-i="${i}" ${seat.kind ? '' : 'disabled'}>${sum.deck || `<span>${seat.kind === 'guest' ? 'Commander they play…' : 'Choose deck…'}</span>`}</button>
              ${sum.what ? seatBrBtn(i, sum.bracket, sum.what) : ''}</div>
          </div></div>`;
      }).join('')}
    </section>
    <button class="btn primary big block start-btn" data-act="startGame">${I.play}Start game</button>`;
  }
  function openSeatPlayerPicker(i) {
    const seats = groupSeats(); const u = me();
    const taken = new Set(seats.slice(0, getSetup().count).filter((x, j) => j !== i && x.kind === 'member').map((x) => x.userId));
    const guests = knownGuests();
    const ov = openSheet(`<div class="sheet-head"><h2>Seat ${i + 1}: who's playing?</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        <div class="sec-title">Group members</div>
        <div class="pick-list">${cd().members.map((m) => `<button class="pick-row ${seats[i].userId === m.id ? 'on' : ''}" data-member="${m.id}" ${taken.has(m.id) ? 'disabled' : ''}>${dot(m.color, 'lg')}<span class="pr-main"><b>${esc(m.display_name)}${m.id === u.id ? ' (you)' : ''}</b><small>${cd().decks.filter((d) => d.owner_id === m.id).length} decks${taken.has(m.id) ? ' · already seated' : ''}</small></span></button>`).join('')}</div>
        <div class="sec-title">Guests <span class="muted">(people without the app)</span></div>
        <div class="guest-new"><input type="text" data-role="gname" placeholder="New guest name" aria-label="New guest name" maxlength="24" autocapitalize="words" autocomplete="off"><button class="btn primary" data-role="gadd">Add</button></div>
        <div class="chip-list">${guests.map((g) => `<button class="gchip ${seats[i].kind === 'guest' && seats[i].name.toLowerCase() === g.name.toLowerCase() ? 'on' : ''}" data-guest="${esc(g.name)}">${esc(g.name)}</button>`).join('') || '<span class="muted small">Guests you add are remembered for next time.</span>'}</div>
        ${seats[i].kind ? '<button class="btn ghost block" data-role="clear">Clear seat</button>' : ''}
      </div>`, { cls: 'tall' });
    const pickGuest = (name) => {
      name = name.trim(); if (!name) return;
      const prev = seats[i].kind === 'guest' && seats[i].name.toLowerCase() === name.toLowerCase() ? seats[i].commander : null;
      const last = guestCommanders(name)[0] || null;
      seats[i] = { kind: 'guest', name, commander: prev || last };
      save(); closeOverlay(ov); renderTab();
      if (!seats[i].commander) setTimeout(() => openGuestCommanderPicker(i), 250);
    };
    ov.addEventListener('click', (e) => {
      const m = e.target.closest('[data-member]');
      if (m) {
        const decks = cd().decks.filter((d) => d.owner_id === m.dataset.member);
        const same = seats[i].userId === m.dataset.member; const keep = same ? seats[i].deckId : null;
        seats[i] = { kind: 'member', userId: m.dataset.member, deckId: keep || (decks.length === 1 ? decks[0].id : null), ...(same && keep && normBracket(seats[i].bracket) ? { bracket: seats[i].bracket } : {}) };
        save(); closeOverlay(ov); renderTab();
        if (!seats[i].deckId && decks.length > 1) setTimeout(() => openSeatDeckPicker(i), 250);
        return;
      }
      const gch = e.target.closest('[data-guest]'); if (gch) { pickGuest(gch.dataset.guest); return; }
      if (e.target.closest('[data-role=gadd]')) { pickGuest(ov.querySelector('[data-role=gname]').value); return; }
      if (e.target.closest('[data-role=clear]')) { seats[i] = { kind: null }; save(); closeOverlay(ov); renderTab(); }
    });
    ov.querySelector('[data-role=gname]').addEventListener('keydown', (e) => { if (e.key === 'Enter') pickGuest(e.target.value); });
  }
  function openSeatDeckPicker(i) {
    const seats = groupSeats(); const seat = seats[i];
    if (seat.kind === 'guest') { openGuestCommanderPicker(i); return; }
    if (seat.kind !== 'member') return;
    const m = memberById(seat.userId); const decks = cd().decks.filter((d) => d.owner_id === seat.userId); const mine = seat.userId === me().id;
    const ov = openSheet(`<div class="sheet-head"><h2>${esc(m ? m.display_name : 'Player')}'s deck</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body"><div class="pick-list">
        ${mine ? `<button class="pick-row new" data-new>+ New deck</button>${IMP ? `<button class="pick-row new imp-pick" data-import>${I.link}<span>Import from Archidekt / Moxfield</span></button>` : ''}` : ''}
        ${decks.map((d) => `<button class="pick-row ${d.id === seat.deckId ? 'on' : ''}" data-deck="${d.id}"><span class="pips">${pips(d.colors)}</span><span class="pr-main"><b>${esc(deckLabel(d))}</b>${d.name || d.bracket ? `<small class="pr-sub">${bchip(d.bracket)}${d.name ? `<span class="ellipsis">${esc(d.name)}</span>` : ''}</small>` : ''}</span></button>`).join('')}
        ${!decks.length ? `<p class="muted small center">${mine ? 'You have no decks yet.' : 'No decks yet — they can add decks in their own app (Commanders tab).'}</p>` : ''}
        <button class="pick-row clear" data-deck="">No deck</button></div></div>`, { cls: 'tall' });
    ov.addEventListener('click', (e) => {
      const nb = e.target.closest('[data-new], [data-import]');
      if (nb) { closeOverlay(ov); openDeckEditor(null, { importOpen: nb.hasAttribute('data-import'), onSave: (d) => { seat.deckId = d.id; delete seat.bracket; save(); renderTab(); } }); return; }
      const b = e.target.closest('[data-deck]'); if (!b) return;
      if ((b.dataset.deck || null) !== seat.deckId) delete seat.bracket;
      seat.deckId = b.dataset.deck || null; save(); closeOverlay(ov); renderTab();
    });
  }
  function openGuestCommanderPicker(i) {
    const seat = groupSeats()[i]; if (seat.kind !== 'guest') return;
    const theirs = guestCommanders(seat.name); const all = allKnownCommanders();
    let q = '';
    const ov = openSheet(`<div class="sheet-head"><h2>${esc(seat.name)}'s commander</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body"><input type="search" class="search" data-role="q" placeholder="Search or type a commander" aria-label="Search or type a commander" autocomplete="off" autocapitalize="words">
      <div class="pick-list" data-role="list"></div></div>`, { cls: 'tall' });
    const list = ov.querySelector('[data-role=list]');
    const row = (c, tag) => `<button class="pick-row" data-c="${esc(JSON.stringify(c))}"><span class="pips">${pips(c.colors)}</span><span class="pr-main"><b>${esc(c.partner ? `${c.name} + ${c.partner}` : c.name)}</b>${tag || c.bracket ? `<small class="pr-sub">${bchip(c.bracket)}${tag ? `<span class="ellipsis">${tag}</span>` : ''}</small>` : ''}</span></button>`;
    const draw = () => {
      const ql = q.trim().toLowerCase(); const f = (c) => !ql || (c.name + ' ' + c.partner).toLowerCase().includes(ql);
      const mineKeys = new Set(theirs.map((c) => (c.name + '|' + c.partner).toLowerCase()));
      const exact = all.some((c) => c.name.toLowerCase() === ql); const link = isDeckLink(q);
      list.innerHTML = `${link ? `<button class="pick-row new imp-pick" data-import="1">${I.link}<span>Import this deck’s commander</span></button>` : ''}
        ${ql && !exact && !link ? `<button class="pick-row new" data-new>+ Use “${esc(q.trim())}”</button>` : ''}
        ${theirs.filter(f).map((c) => row(c, `played by ${esc(seat.name)} before`)).join('')}
        ${all.filter((c) => f(c) && !mineKeys.has((c.name + '|' + c.partner).toLowerCase())).map((c) => row({ name: c.name, partner: c.partner, colors: c.colors }, '')).join('')}
        ${!ql ? `<button class="pick-row new" data-new>+ Other commander</button>${IMP ? `<button class="pick-row new imp-pick" data-import>${I.link}<span>Import from Archidekt / Moxfield</span></button>` : ''}` : ''}`;
    };
    ov.querySelector('[data-role=q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-new')) { closeOverlay(ov); openGuestCommanderForm(i, q.trim()); return; }
      if (b.hasAttribute('data-import')) { closeOverlay(ov); openGuestCommanderForm(i, '', { importOpen: true, importSrc: isDeckLink(q) ? q.trim() : '' }); return; }
      seat.commander = JSON.parse(b.dataset.c); save(); closeOverlay(ov); renderTab();
    });
    draw();
  }
  function openGuestCommanderForm(i, name, opts = {}) {
    const seat = groupSeats()[i]; const st = { colors: [], bracket: null };
    const ov = openSheet(`<div class="sheet-head"><h2>${esc(seat.name)}'s commander</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        ${importBoxHtml({ open: opts.importOpen, src: opts.importSrc })}
        <div class="field"><label>Commander</label><input type="text" data-f="name" value="${esc(name)}" maxlength="80" autocapitalize="words"></div>
        <div class="field"><label>Partner / background <span class="muted">(optional)</span></label><input type="text" data-f="partner" maxlength="80" autocapitalize="words"></div>
        <div class="field"><label>Color identity</label><div class="color-toggles">${WUBRG.map((x) => `<button class="ctog pip-${x}" data-color="${x}" aria-label="${COLOR_NAME[x]}" aria-pressed="false">${x}</button>`).join('')}</div></div>
        <div class="field br-field"><label>Commander Bracket <span class="muted">(optional)</span></label>${bracketPicker(null)}</div>
        <button class="btn primary big block" data-a="ok">Use this commander</button></div>`, { cls: 'tall' });
    bindBracketPicker(ov.querySelector('.br-field'), () => st.bracket, (v) => { st.bracket = v; });
    bindImport(ov, {
      saveLabel: 'Use this commander', auto: !!opts.importSrc,
      apply: (deck) => {
        ov.querySelector('[data-f=name]').value = deck.commanders[0].name;
        ov.querySelector('[data-f=partner]').value = deck.commanders[1] ? deck.commanders[1].name : '';
        st.colors = deck.colors.slice(); paintColors(ov, st.colors);
        if (deck.bracket || st.brImported) { st.bracket = deck.bracket; paintBracketPicker(ov.querySelector('.br-field'), deck.bracket); }
        st.brImported = !!deck.bracket;
      },
    });
    ov.addEventListener('click', (e) => {
      const t = e.target.closest('[data-color]');
      if (t) { const x = t.dataset.color; st.colors = st.colors.includes(x) ? st.colors.filter((y) => y !== x) : WUBRG.filter((y) => y === x || st.colors.includes(y)); t.classList.toggle('on', st.colors.includes(x)); t.setAttribute('aria-pressed', st.colors.includes(x)); return; }
      if (!e.target.closest('[data-a=ok]')) return;
      const n = ov.querySelector('[data-f=name]').value.trim(); if (!n) { toast('Enter the commander name'); return; }
      seat.commander = { name: n, partner: ov.querySelector('[data-f=partner]').value.trim(), colors: st.colors, bracket: st.bracket };
      save(); closeOverlay(ov); renderTab();
    });
  }
  function groupPlayers(s) {
    const seats = groupSeats().slice(0, s.count);
    const ids = seats.filter((x) => x.kind === 'member').map((x) => x.userId);
    if (new Set(ids).size !== ids.length) { toast('The same member is seated twice'); return null; }
    return seats.map((seat, i) => {
      const base = { id: 'p' + i, seat: i, life: s.life, poison: 0, cmd: {}, tax: [0, 0], eliminated: false, elimOrder: null, elimReason: null, killedBy: null };
      if (seat.kind === 'member') {
        const m = memberById(seat.userId); const d = deckById(seat.deckId);
        return { ...base, kind: 'member', userId: seat.userId, name: m ? m.display_name : 'Player ' + (i + 1), deckId: d ? d.id : null, commanderId: d ? d.id : null, commanderName: d ? d.commander : '', partnerName: d ? d.partner || '' : '', colors: d ? d.colors.slice() : [], bracket: d ? seatBracket(seat) : null };
      }
      if (seat.kind === 'guest') {
        const c = seat.commander || {}; const known = knownGuests().find((x) => x.name.toLowerCase() === seat.name.toLowerCase());
        return { ...base, kind: 'guest', guestId: known ? known.id : null, name: seat.name, commanderId: null, commanderName: c.name || '', partnerName: c.partner || '', colors: c.colors || [], bracket: c.name ? normBracket(c.bracket) : null };
      }
      return { ...base, kind: 'guest', guestId: null, name: `Player ${i + 1}`, commanderId: null, commanderName: '', partnerName: '', colors: [], bracket: null };
    });
  }

  // ----- decks (group mode Commanders tab) -----
  function renderDecks(v) {
    const u = me(); const stats = commanderStats(); const empty = { games: 0, wins: 0, dur: 0, last: 0, kills: 0 };
    const card = (d, editable) => { const s = stats.get(d.id) || empty; return `<button class="cmd-card" ${editable ? `data-act="editDeck" data-id="${d.id}"` : 'disabled'} style="--deck:${manaGrad(d.colors)}">
      <div class="cc-top"><div class="cc-name"><b>${esc(d.commander)}</b>${d.partner ? `<small>+ ${esc(d.partner)}</small>` : ''}<span class="cc-meta"><span class="pips" aria-label="${colorWords(d.colors)}" role="img">${pips(d.colors)}</span>${bchip(d.bracket)}${d.name ? `<small class="owner">${esc(d.name)}</small>` : ''}</span></div>
      ${wrRing(s)}</div>
      <div class="cc-stats"><span><b>${s.games}</b> game${s.games === 1 ? '' : 's'}</span><span><b>${s.wins}</b> win${s.wins === 1 ? '' : 's'}</span><span><b>${s.games ? fmtDur(s.dur / s.games) : '—'}</b> avg</span>${s.kills ? `<span><b>${s.kills}</b> cmdr kills</span>` : ''}<span>${s.last ? 'Last ' + fmtShort(s.last) : 'Never played'}</span></div></button>`; };
    const decks = cd().decks; const myDecks = decks.filter((d) => d.owner_id === u.id);
    const others = cd().members.filter((m) => m.id !== u.id);
    // guest commanders from game history
    const gc = new Map();
    cd().games.forEach((g) => g.players.forEach((p) => {
      if (p.kind !== 'guest' || !p.commanderName) return;
      const label = p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName; const k = p.name.toLowerCase() + '|' + label.toLowerCase();
      const e = gc.get(k) || { who: p.name, label, colors: p.colors || [], g: 0, w: 0 }; e.g++; if (p.isWinner) e.w++; gc.set(k, e);
    }));
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">${esc(cloud.group().name)}</div><h1>Decks</h1></div><button class="btn primary sm" data-act="newDeck">+ Add</button></header>
      <div class="sec-title">My decks</div>
      ${myDecks.length ? myDecks.map((d) => card(d, true)).join('') : '<div class="card muted small">No decks yet. Add the decks you play so your group can pick them at game setup.</div>'}
      ${others.map((m) => { const ds = decks.filter((d) => d.owner_id === m.id); return `<div class="sec-title">${dot(m.color)} ${esc(m.display_name)}'s decks</div>${ds.length ? ds.map((d) => card(d, false)).join('') : '<div class="card muted small">No decks yet.</div>'}`; }).join('')}
      ${gc.size ? `<div class="sec-title">Guest commanders</div><section class="card">${[...gc.values()].sort((a, b) => b.g - a.g).map((e) => `<div class="bar-row stack"><div class="bs-top"><span class="bar-label"><span class="pips">${pips(e.colors)}</span><span class="ellipsis"><b>${esc(e.label)}</b> <span class="muted small">${esc(e.who)}</span></span></span><span class="bar-val"><small>${e.w}/${e.g}</small>${pct(e.w, e.g)}</span></div><div class="bar deck" style="--fill:${manaGrad(e.colors, '90deg')}"><i style="width:${Math.round((e.w / e.g) * 100)}%"></i></div></div>`).join('')}</section>` : ''}`;
  }
  function openDeckEditor(id, opts = {}) {
    if (!cloud.online()) { toast('Connect to the internet to edit decks'); return; }
    const d = id ? deckById(id) : null;
    const st = { colors: d ? d.colors.slice() : [], bracket: d ? normBracket(d.bracket) : null, link: d ? cleanLink(d.link) : '' };
    const s = d ? commanderStats().get(d.id) : null;
    const ov = openSheet(`<div class="sheet-head"><h2>${d ? 'Edit deck' : 'New deck'}</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body">
        ${importBoxHtml({ open: opts.importOpen, src: opts.importSrc })}
        <div class="field"><label>Commander</label><input type="text" data-f="commander" value="${esc(d ? d.commander : '')}" maxlength="80" autocapitalize="words" placeholder="e.g. Atraxa, Praetors' Voice"></div>
        <div class="field"><label>Partner / background <span class="muted">(optional)</span></label><input type="text" data-f="partner" value="${esc(d ? d.partner || '' : '')}" maxlength="80" autocapitalize="words"></div>
        <div class="field"><label>Color identity</label><div class="color-toggles">${WUBRG.map((x) => `<button class="ctog pip-${x} ${st.colors.includes(x) ? 'on' : ''}" data-color="${x}" aria-label="${COLOR_NAME[x]}" aria-pressed="${st.colors.includes(x)}">${x}</button>`).join('')}</div><div class="muted small">None selected = colorless</div></div>
        <div class="field"><label>Deck name <span class="muted">(optional)</span></label><input type="text" data-f="name" value="${esc(d ? d.name || '' : '')}" maxlength="60" placeholder="e.g. Superfriends"></div>
        <div class="field br-field"><label>Commander Bracket <span class="muted">(optional)</span></label>${bracketPicker(st.bracket)}</div>
        ${linkedHtml(st.link)}
        ${s ? `<div class="mini-stats"><div><b>${s.games}</b><span>games</span></div><div><b>${s.wins}</b><span>wins</span></div><div><b>${pct(s.wins, s.games)}</b><span>win rate</span></div><div><b>${fmtDur(s.dur / s.games)}</b><span>avg game</span></div></div>${cmdTurnHtml(s)}` : ''}
        <div class="sheet-actions">${d ? '<button class="btn danger-text" data-a="delete">Delete</button>' : ''}<button class="btn primary grow" data-a="save">${d ? 'Save' : 'Add deck'}</button></div>
      </div>`, { cls: 'tall' });
    bindBracketPicker(ov.querySelector('.br-field'), () => st.bracket, (v) => { st.bracket = v; });
    let busy = false;
    // update one of my existing decks with what was imported / typed (keeps its own bracket / name / link when the import has none)
    const updateExisting = async (x, v) => {
      if (busy) return; busy = true;
      try {
        const saved = await cloud.saveDeck({ id: x.id, commander: v.commander, partner: v.partner, name: v.name || x.name || '', colors: v.colors, bracket: v.bracket || normBracket(x.bracket), link: v.link || cleanLink(x.link) || null });
        closeOverlay(ov); toast('Deck updated'); if (opts.onSave) opts.onSave(saved); else renderTab();
      } catch (err) { toast(err.message); } finally { busy = false; }
    };
    const imp = bindImport(ov, {
      saveLabel: d ? 'Save' : 'Add deck', auto: !!opts.importSrc,
      apply: (deck) => {
        ov.querySelector('[data-f=commander]').value = deck.commanders[0].name;
        ov.querySelector('[data-f=partner]').value = deck.commanders[1] ? deck.commanders[1].name : '';
        if (deck.name) ov.querySelector('[data-f=name]').value = deck.name;
        st.colors = deck.colors.slice(); paintColors(ov, st.colors);
        if (deck.bracket || st.brImported) { st.bracket = deck.bracket; paintBracketPicker(ov.querySelector('.br-field'), deck.bracket); }
        st.brImported = !!deck.bracket;
        st.link = deck.url || (d ? cleanLink(d.link) : '');
      },
      dup: (deck) => {
        if (d) return null;
        const k = deckKey(deck);
        const x = cd().decks.find((y) => y.owner_id === me().id && ((deck.url && y.link === deck.url) || cmdKey(y.commander, y.partner) === k));
        return x ? { item: x, label: deckLabel(x), who: x.name || '' } : null;
      },
      onUpdate: (deck, x) => updateExisting(x, { commander: deck.commanders[0].name, partner: deck.commanders[1] ? deck.commanders[1].name : '', name: deck.name, colors: deck.colors, bracket: deck.bracket, link: deck.url }),
    });
    ov.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-color]');
      if (t) { const x = t.dataset.color; st.colors = st.colors.includes(x) ? st.colors.filter((y) => y !== x) : WUBRG.filter((y) => y === x || st.colors.includes(y)); t.classList.toggle('on', st.colors.includes(x)); t.setAttribute('aria-pressed', st.colors.includes(x)); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      try {
        if (a.dataset.a === 'save') {
          const f = (k) => ov.querySelector(`[data-f=${k}]`).value.trim();
          if (!f('commander')) { toast('Enter the commander name'); return; }
          const vals = { commander: f('commander'), partner: f('partner'), name: f('name'), colors: st.colors, bracket: st.bracket, link: st.link };
          if (!d && imp.found && imp.dup) {
            const pickd = await askDuplicate(imp.dup); if (!pickd) return;
            if (pickd === 'update') { await updateExisting(imp.dup.item, vals); return; }
          }
          a.disabled = true;
          const saved = await cloud.saveDeck({ id: d && d.id, commander: vals.commander, partner: vals.partner, name: vals.name, colors: vals.colors, bracket: vals.bracket, ...(st.link ? { link: st.link } : {}) });
          closeOverlay(ov); toast(d ? 'Deck saved' : 'Deck added');
          if (opts.onSave) opts.onSave(saved); else renderTab();
        } else if (a.dataset.a === 'delete') {
          if (!(await confirmDialog(`Delete <b>${esc(deckLabel(d))}</b>? Past games keep their record.`, 'Delete', true))) return;
          await cloud.deleteDeck(d.id); closeOverlay(ov); toast('Deck deleted'); renderTab();
        }
      } catch (x) { a.disabled = false; toast(x.message); }
    });
  }

  // ---------- event wiring ----------
  const ACTIONS = {
    tab: (el) => setTab(el.dataset.tab),
    setCount: (el) => { getSetup().count = +el.dataset.v; save(); renderTab(); },
    setLife: (el) => { getSetup().life = +el.dataset.v; save(); renderTab(); },
    pickCmd: (el) => openCmdPicker(+el.dataset.i),
    seatBracket: (el) => openSeatBracket(+el.dataset.i),
    startGame: () => startGame(),
    resumeGame: () => openGame(),
    discardGame: async () => { if (await confirmDialog('Discard the game in progress?', 'Discard', true)) { data.current = null; save(true); renderTab(); } },
    newCmd: () => openCmdEditor(null),
    editCmd: (el) => openCmdEditor(el.dataset.id),
    cmdSort: (el) => { cmdSort = el.dataset.v; renderTab(); },
    deleteGame: async (el) => {
      const g = allGames().find((x) => x.id === el.dataset.id); if (!g) return;
      if (!(await confirmDialog(`Delete the game from ${fmtDate(g.endedAt)}?${gm() ? ' It is removed for the whole group.' : ''} Stats will be recalculated.`, 'Delete', true))) return;
      if (gm()) cloud.deleteGame(g.id); else { data.games = data.games.filter((x) => x !== g); save(true); }
      renderTab(); toast('Game deleted');
    },
    // online playgroups
    pickSeatPlayer: (el) => openSeatPlayerPicker(+el.dataset.i),
    pickSeatDeck: (el) => openSeatDeckPicker(+el.dataset.i),
    authSignin: () => openAuth(),
    authSignup: () => openAuth('signup'),
    authGoogle: () => startGoogle(),
    authOther: () => openAuth('signin'),
    setPassword: async () => {
      const pw = await promptText('App password', `Lets you sign in with ${me().email || 'your email'} + this password, e.g. if Google sign-in doesn't return to the Home Screen app.`, '', { ok: 'Save password', type: 'password', max: 72 });
      if (!pw) return;
      try { await cloud.setPassword(pw); toast('Password saved — sign in with your Google email + password'); } catch (e) { toast(e.message); }
    },
    goSettings: () => setTab('settings'),
    goPlay: () => setTab('play'),
    moreHistory: () => { histLimit += 50; renderTab(); },
    editProfile: () => editProfile(),
    statsScope: (el) => { statsScope = el.dataset.v; renderTab(); },
    posSize: (el) => { posSize = el.dataset.v === 'all' ? 'all' : +el.dataset.v; renderTab(); },
    posBy: (el) => { posBy = el.dataset.v; renderTab(); },
    solBy: (el) => { solBy = el.dataset.v; renderTab(); },
    posBr: (el) => { posBr = el.dataset.v === 'any' || el.dataset.v === 'mixed' ? el.dataset.v : +el.dataset.v; renderTab(); },
    brBy: (el) => { brBy = el.dataset.v; renderTab(); },
    newDeck: () => openDeckEditor(null),
    editDeck: (el) => openDeckEditor(el.dataset.id),
    syncNow: async () => {
      if (!cloud.online()) { toast('Offline — games will sync when you are back online'); return; }
      toast('Syncing…'); const ok = await cloud.refresh(); renderTab();
      toast(ok && !cloud.pending() ? 'All synced' : cloud.lastError() || `${cloud.pending()} still pending`);
    },
    signOut: async () => {
      const n = cloud.pending();
      const msg = n ? `<b>${n} game${n === 1 ? ' is' : 's are'} not uploaded yet</b> and will be lost if you sign out now. Sign out anyway?` : 'Sign out of your account on this phone? Local (offline) data stays.';
      if (!(await confirmDialog(msg, 'Sign out', n > 0))) return;
      await cloud.signOut(); statsScope = 'group'; renderTab(); toast('Signed out');
    },
    shareInvite: async () => {
      const g = cloud.group(); const url = inviteLink(g.invite_code);
      const text = `Join my playgroup “${g.name}” on Commander Tracker. Invite code: ${g.invite_code}`;
      if (navigator.share) { try { await navigator.share({ title: 'Commander Tracker', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Invite link copied'); } catch (e) { toast(url); }
    },
    copyCode: async () => { const c = cloud.group().invite_code; try { await navigator.clipboard.writeText(c); toast('Code copied'); } catch (e) { toast(c); } },
    createGroup: async () => {
      if (!cloud.online()) { toast('Connect to the internet to create a group'); return; }
      const name = await promptText('New playgroup', 'Group name', me().display_name + "'s group", { ok: 'Create' }); if (!name) return;
      try { const g = await cloud.createGroup(name); toast(`Created ${g.name} — share the invite code`); renderTab(); maybeOfferMigration(); } catch (e) { toast(e.message); }
    },
    joinGroupPrompt: async () => {
      if (!cloud.online()) { toast('Connect to the internet to join a group'); return; }
      const code = await promptText('Join a playgroup', 'Invite code', pendingJoinCode() || '', { ok: 'Join', upper: true, max: 8 }); if (!code) return;
      try { const g = await cloud.joinGroup(code.toUpperCase().replace(/[^A-Z0-9]/g, '')); localStorage.removeItem(JOIN_KEY); toast(`Joined ${g.name}`); renderTab(); maybeOfferMigration(); } catch (e) { toast(e.message); }
    },
    leaveGroup: async () => {
      const g = cloud.group();
      if (!(await confirmDialog(`Leave <b>${esc(g.name)}</b>? Games stay with the group; you can rejoin with the invite code.`, 'Leave', true))) return;
      try { await cloud.leaveGroup(g.id); renderTab(); toast('Left the group'); } catch (e) { toast(e.message); }
    },
    migrate: () => openMigration(cloud.groupId()),
    defLife: (el) => { data.settings.startingLife = +el.dataset.v; getSetup().life = +el.dataset.v; save(); renderTab(); },
    defCount: (el) => { data.settings.playerCount = +el.dataset.v; getSetup().count = +el.dataset.v; save(); renderTab(); },
    exportData: () => exportData(),
    copyData: async () => { try { await navigator.clipboard.writeText(backupJson()); toast('Backup copied to clipboard'); } catch (e) { toast('Clipboard not available'); } },
    wipeData: async () => {
      if (!(await confirmDialog('Delete <b>all</b> commanders, games and settings from this device? This cannot be undone.', 'Delete everything', true))) return;
      data = defaults(); save(true); renderTab(); toast('All data deleted');
    },
    playerSheet: (el) => { const panel = el.closest('.panel'); if (panel) openPlayerSheet(panel.dataset.pid); },
    gameMenu: () => { dismissTapHint(); openGameMenu(); },
    displayInfo: () => openDisplayInfo(),
  };
  document.addEventListener('click', (e) => {
    const tp = e.target.closest('#view .tp-seat[data-tp]'); if (tp) { e.preventDefault(); tapSetupSeat(+tp.dataset.tp); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACTIONS[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
  });
  const BINDS = {
    seatName: (el) => { getSetup().seats[+el.dataset.i].name = el.value; save(); repaintSetupPreview(); },
    customLife: (el) => {
      const n = parseInt(el.value, 10);
      if (n > 0 && n < 1000) { getSetup().life = n; save(); $$('#life-seg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === n)); el.classList.toggle('on', !LIFE_PRESETS.includes(n)); }
    },
    randomFirst: (el) => { data.settings.randomFirst = el.checked; save(); repaintSetupPreview(); },
    wideLayout: (el) => { try { localStorage.setItem(WIDE_KEY, el.checked ? '1' : '0'); } catch (e) { /* private mode */ } },
    spinClock: (el) => { data.settings.spinClock = el.checked; save(); const bd = $('#board'); if (bd) bd.classList.toggle('no-spin', !el.checked); },
    wakeLock: (el) => { data.settings.wakeLock = el.checked; save(); },
    importFile: (el) => { const f = el.files && el.files[0]; el.value = ''; if (f) importFile(f); },
    groupSel: (el) => { cloud.setGroup(el.value); renderTab(); },
  };
  const onBind = (e) => {
    const el = e.target; const b = el.dataset && el.dataset.bind; if (!b || !BINDS[b]) return;
    const wants = el.type === 'file' || el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    if (e.type === wants) BINDS[b](el, e);
  };
  document.addEventListener('input', onBind);
  document.addEventListener('change', onBind);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // Fallback for browsers without container query units (iOS < 16)
  if (!(window.CSS && CSS.supports && CSS.supports('width', '1cqw'))) {
    document.documentElement.classList.add('no-cq');
    const fit = () => $$('.panel').forEach((p) => { const c = p.parentElement; const w = c.clientWidth, h = c.clientHeight; const side = p.classList.contains('side'); p.style.width = (side ? h : w) + 'px'; p.style.height = (side ? w : h) + 'px'; });
    new MutationObserver(fit).observe($('#game'), { childList: true }); window.addEventListener('resize', fit);
  }

  // ---------- viewport ----------
  // iOS 26 Home Screen web apps (WebKit bug 301994): the web view is ~62px shorter than the screen and the system paints
  // an opaque bar below it that no DOM element can reach. So never size layers beyond innerHeight; instead fit the painted
  // area exactly and, when that gap exists, drop the home-indicator inset (the web view already ends above it).
  const probe = document.createElement('div');
  probe.id = 'sa-probe';
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.documentElement.appendChild(probe);
  const vp = {};
  function fitViewport() {
    const root = document.documentElement; const standalone = isStandalone();
    const cs = getComputedStyle(probe);
    const sat = parseFloat(cs.paddingTop) || 0, sab = parseFloat(cs.paddingBottom) || 0;
    const h = window.innerHeight;
    const portrait = window.innerHeight >= window.innerWidth;
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    // content drawn from the very top (sat > 0) but shorter than the screen => unpainted band at the bottom
    const gapBelow = standalone && isIOS && sat > 0 ? Math.max(0, Math.round(screenH - h)) : 0;
    root.style.setProperty('--app-h', h + 'px'); root.style.setProperty('--app-w', window.innerWidth + 'px');
    if (gapBelow > 0) root.style.setProperty('--sab', Math.max(4, sab - gapBelow) + 'px');
    else root.style.removeProperty('--sab');
    root.classList.toggle('standalone', standalone);
    root.classList.toggle('notch', sat > 0 && gapBelow === 0);
    root.classList.toggle('ios-gap', gapBelow > 0);
    Object.assign(vp, { sat, sab, gapBelow, screenH, h });
  }
  fitViewport();
  window.addEventListener('resize', fitViewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitViewport);
  window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300));
  window.addEventListener('pageshow', fitViewport);

  async function openDisplayInfo() {
    fitViewport();
    const cs = getComputedStyle(probe); const root = document.documentElement; const vv = window.visualViewport;
    const rh = (el) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 + 'px' : '—');
    const gameEl = $('#game');
    let swCache = '—'; try { swCache = (await caches.keys()).join(', ') || 'none'; } catch (e) { /* no caches */ }
    const rows = [
      ['App version', APP_VERSION], ['SW cache', swCache],
      ['navigator.standalone', String(navigator.standalone)], ['display-mode: standalone', String(matchMedia('(display-mode: standalone)').matches)],
      ['window.innerWidth × innerHeight', `${innerWidth} × ${innerHeight}`], ['documentElement.clientHeight', root.clientHeight],
      ['visualViewport.height / offsetTop', vv ? `${Math.round(vv.height * 10) / 10} / ${vv.offsetTop}` : 'n/a'],
      ['screen.width × height', `${screen.width} × ${screen.height}`], ['devicePixelRatio', devicePixelRatio],
      ['safe-area-inset top / bottom', `${cs.paddingTop} / ${cs.paddingBottom}`], ['safe-area-inset left / right', `${cs.paddingLeft} / ${cs.paddingRight}`],
      ['Detected unpainted band below', vp.gapBelow + 'px'], ['--app-h (game layer size)', getComputedStyle(root).getPropertyValue('--app-h').trim()], ['Game layout', { wide: 'wide (landscape screen)', wide90: 'wide, turned 90° (upright screen)', tall: 'tall (wide layout off)' }[boardMode().key]],
      ['Effective bottom inset (--sab)', getComputedStyle(root).getPropertyValue('--sab').trim()],
      ['html height', rh(root)], ['body height', rh(document.body)], ['game layer height', gameEl.hidden ? 'hidden (open during a game)' : rh(gameEl)],
      ['User agent', navigator.userAgent],
    ];
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    const ov = openSheet(`<div class="sheet-head"><h2>Display info</h2><button class="icon-btn" data-close aria-label="Close">${I.close}</button></div>
      <div class="sheet-body"><p class="muted small">Screenshot this screen to report layout issues.</p>
      <div class="diag">${rows.map(([k, v]) => `<div class="diag-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <button class="btn block" data-role="copy">Copy as text</button></div>`, { cls: 'tall diag-sheet' });
    ov.querySelector('[data-role=copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Clipboard not available'); }
    });
  }

  // ---------- boot ----------
  captureJoinParam();
  renderTab();
  if (data.current) openGame();
  const oauthReturn = /[?&](code|error)=/.test(location.search);
  if (shouldShowLogin() || (oauthReturn && !me())) showLogin({ busy: oauthReturn && !!cloud });
  if (cloud) cloud.init().then((res = {}) => {
    requestRender();
    if (me()) hideLogin(); else if (loginVisible()) showLogin({ error: res.error || '' });
    if (!$('#game').hidden) return;
    if (res.justSignedIn && me()) { toast(`Signed in as ${me().display_name}`); afterSignIn(true); return; }
    if (res.error && !loginVisible()) { toast(res.error); openAuth('google', { note: esc(res.error) }); return; }
    if (res.wrongPlace && !me()) { oauthWrongPlace(); return; }
    if (pendingJoinCode() && (me() || (freshInvite && !loginVisible()))) handlePendingJoin();
  });
  else if (pendingJoinCode()) toast('Connect to the internet to join the playgroup');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Upgrade: the new worker navigates open windows itself; when it can't (Safari may not, or not in time), the page
    // reloads once when the new worker takes control, after any open dialog closes. Game state is saved first.
    let reloading = false;
    const reloadForUpdate = () => { if (reloading) return; reloading = true; save(true); const go = () => { if ($('.overlay')) setTimeout(go, 1500); else location.reload(); }; go(); };
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'sw-updated') reloadForUpdate(); });
    const hadController = !!navigator.serviceWorker.controller; // no controller yet = first install, nothing stale on screen
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadForUpdate(); });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('SW registration failed', e)));
  }
  document.addEventListener('visibilitychange', () => { document.documentElement.classList.toggle('page-hidden', document.hidden); if (!document.hidden) updateCenter(); });
  window.__edh = { get data() { return data; }, setCenterCycle: (every, show) => { CENTER.every = every; CENTER.show = show; centerStart = Date.now(); updateCenter(); } }; // debug/test hooks
})();
