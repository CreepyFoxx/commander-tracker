/* Commander Tracker — life, commander damage & stats for MTG Commander. Plain JS, no dependencies. */
'use strict';
(function () {
  const STORE_KEY = 'edh-tracker:v1';
  const APP_VERSION = '1.1.1';
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];
  const COLOR_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
  const REASON = { life: 'life total', commander: 'commander damage', poison: 'poison', conceded: 'conceded' };
  const LIFE_PRESETS = [20, 25, 30, 40];
  // [row, col, colSpan, rotation] per seat, seats listed clockwise around the table
  const LAYOUTS = {
    2: { rows: 2, cols: 1, seats: [[1, 1, 1, 180], [2, 1, 1, 0]] },
    3: { rows: 2, cols: 2, seats: [[1, 1, 2, 180], [2, 2, 1, -90], [2, 1, 1, 90]] },
    4: { rows: 2, cols: 2, seats: [[1, 1, 1, 90], [1, 2, 1, -90], [2, 2, 1, -90], [2, 1, 1, 90]] },
    5: { rows: 3, cols: 2, seats: [[1, 1, 2, 180], [2, 2, 1, -90], [3, 2, 1, -90], [3, 1, 1, 90], [2, 1, 1, 90]] },
    6: { rows: 3, cols: 2, seats: [[1, 1, 1, 90], [1, 2, 1, -90], [2, 2, 1, -90], [3, 2, 1, -90], [3, 1, 1, 90], [2, 1, 1, 90]] },
  };
  const I = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    sword: '<svg viewBox="0 0 24 24" class="ico-sword"><path d="M14.5 3.5H20.5V9.5L9 21 3 15z" /><path d="M6 12l6 6M4 20l2-2"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4M12 13v4M8 20h8M9.5 17h5"/></svg>',
  };

  // ---------- store ----------
  function defaults() {
    return {
      version: 1, commanders: [], games: [],
      settings: { startingLife: 40, playerCount: 4, wakeLock: true, randomFirst: true },
      lastSetup: null, current: null,
    };
  }
  function sanitizeCommander(c) {
    return {
      id: String(c.id || uid()), name: String(c.name || 'Unnamed').slice(0, 80),
      partner: String(c.partner || '').slice(0, 80),
      colors: WUBRG.filter((x) => Array.isArray(c.colors) && c.colors.includes(x)),
      owner: String(c.owner || '').slice(0, 40), createdAt: +c.createdAt || Date.now(),
    };
  }
  function normalize(d) {
    const out = Object.assign(defaults(), d || {});
    out.settings = Object.assign(defaults().settings, (d && d.settings) || {});
    out.commanders = Array.isArray(out.commanders) ? out.commanders.map(sanitizeCommander) : [];
    out.games = Array.isArray(out.games) ? out.games.filter((g) => g && Array.isArray(g.players)) : [];
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
  function save(now) {
    clearTimeout(saveTimer);
    const run = () => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { toast('Could not save — storage full?'); }
    };
    if (now) run(); else saveTimer = setTimeout(run, 200);
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
  function pips(colors) {
    if (!colors || !colors.length) return '<span class="pip pip-C"></span>';
    return colors.map((c) => `<span class="pip pip-${c}"></span>`).join('');
  }
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
  function openSheet(html, opts = {}) {
    const ov = document.createElement('div');
    const rot = opts.rot || 0;
    ov.className = 'overlay' + (opts.dialog ? ' is-dialog' : '');
    ov.innerHTML = `<div class="backdrop"></div><div class="rot-frame ${Math.abs(rot) === 90 ? 'side' : ''}" style="--rot:${rot}deg"><div class="sheet ${opts.cls || ''}">${html}</div></div>`;
    $('#overlay-root').appendChild(ov);
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
    setTimeout(() => ov.remove(), 220);
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
  function renderTab() {
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const v = $('#view');
    ({ play: renderPlay, commanders: renderCommanders, stats: renderStats, history: renderHistory, settings: renderSettings })[tab](v);
  }
  function setTab(t) { tab = t; renderTab(); window.scrollTo(0, 0); }

  // ---------- setup ----------
  function getSetup() {
    if (!data.lastSetup) data.lastSetup = { count: data.settings.playerCount, life: data.settings.startingLife, seats: [] };
    const s = data.lastSetup;
    while (s.seats.length < 6) s.seats.push({ name: '', commanderId: null });
    return s;
  }
  function installHint() {
    if (isStandalone()) return '';
    return `<div class="card hint-card"><b>Install on your iPhone</b><p>Open this page in Safari, tap <b>Share</b> <span class="share-ico">⬆︎</span> then <b>Add to Home Screen</b>. It runs full-screen and offline. Your data lives only on this device — use Settings → Export to back it up.</p></div>`;
  }
  function renderPlay(v) {
    const s = getSetup(); const g = data.current;
    v.innerHTML = `
    <header class="page-head"><div><div class="eyebrow">Commander Tracker</div><h1>New game</h1></div></header>
    ${g ? `<div class="card resume"><div><b>Game in progress</b><div class="muted small">${g.players.length} players · started ${fmtTime(g.startedAt)}</div></div>
      <div class="row"><button class="btn ghost sm" data-act="discardGame">Discard</button><button class="btn primary sm" data-act="resumeGame">Resume</button></div></div>` : ''}
    <section class="card">
      <div class="field"><label>Players</label><div class="seg">${[2, 3, 4, 5, 6].map((n) => `<button data-act="setCount" data-v="${n}" class="${s.count === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>Starting life</label><div class="seg" id="life-seg">${LIFE_PRESETS.map((n) => `<button data-act="setLife" data-v="${n}" class="${s.life === n ? 'on' : ''}">${n}</button>`).join('')}
        <input class="seg-input ${LIFE_PRESETS.includes(s.life) ? '' : 'on'}" type="number" inputmode="numeric" min="1" max="999" placeholder="Other" value="${LIFE_PRESETS.includes(s.life) ? '' : s.life}" data-bind="customLife"></div></div>
      <label class="switch-row"><span>Random first player</span><input type="checkbox" data-bind="randomFirst" ${data.settings.randomFirst ? 'checked' : ''}><i class="switch"></i></label>
    </section>
    <section class="card">
      <div class="card-title">Seats <span class="muted small">clockwise around the table</span></div>
      ${s.seats.slice(0, s.count).map((seat, i) => {
        const c = getCmd(seat.commanderId);
        return `<div class="seat-row">
          <span class="seat-dot seat-${i}">${i + 1}</span>
          <div class="seat-fields">
            <input type="text" list="player-names" placeholder="Player ${i + 1}" value="${esc(seat.name)}" data-bind="seatName" data-i="${i}" autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="24">
            <button class="cmd-pick ${c ? '' : 'empty'}" data-act="pickCmd" data-i="${i}">${c ? `<span class="pips">${pips(c.colors)}</span><span class="ellipsis">${esc(cmdLabel(c))}</span>` : '<span>Choose commander…</span>'}</button>
          </div></div>`;
      }).join('')}
      <datalist id="player-names">${knownPlayers().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </section>
    <button class="btn primary big block" data-act="startGame">Start game</button>
    ${installHint()}`;
  }

  function openCmdPicker(i) {
    const s = getSetup(); const seatName = s.seats[i].name.trim().toLowerCase();
    let q = '';
    const last = lastPlayedMap();
    const ov = openSheet(`<div class="sheet-head"><h2>Commander · seat ${i + 1}</h2><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body"><input type="search" class="search" placeholder="Search or type a new commander" data-role="q" autocomplete="off" autocapitalize="words">
      <div class="pick-list" data-role="list"></div></div>`, { cls: 'tall' });
    const list = ov.querySelector('[data-role=list]');
    const draw = () => {
      const ql = q.trim().toLowerCase();
      const cs = data.commanders.filter((c) => !ql || cmdLabel(c).toLowerCase().includes(ql) || c.owner.toLowerCase().includes(ql))
        .sort((a, b) => ((b.owner.toLowerCase() === seatName) - (a.owner.toLowerCase() === seatName)) || ((last.get(b.id) || 0) - (last.get(a.id) || 0)) || a.name.localeCompare(b.name));
      const exact = data.commanders.some((c) => c.name.toLowerCase() === ql);
      list.innerHTML = `${ql && !exact ? `<button class="pick-row new" data-new>+ Create “${esc(q.trim())}”</button>` : ''}
        ${!ql ? '<button class="pick-row new" data-new>+ New commander</button>' : ''}
        ${cs.map((c) => `<button class="pick-row ${c.id === s.seats[i].commanderId ? 'on' : ''}" data-id="${c.id}"><span class="pips">${pips(c.colors)}</span><span class="pr-main"><b>${esc(cmdLabel(c))}</b>${c.owner ? `<small>${esc(c.owner)}</small>` : ''}</span></button>`).join('')}
        ${s.seats[i].commanderId ? '<button class="pick-row clear" data-id="">No commander</button>' : ''}
        ${!cs.length && !ql ? '<p class="muted small center">No saved commanders yet.</p>' : ''}`;
    };
    ov.querySelector('[data-role=q]').addEventListener('input', (e) => { q = e.target.value; draw(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-new')) {
        closeOverlay(ov);
        openCmdEditor(null, { name: q.trim(), owner: s.seats[i].name.trim(), onSave: (c) => {
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

  function openCmdEditor(id, opts = {}) {
    const c = getCmd(id);
    const st = { name: c ? c.name : opts.name || '', partner: c ? c.partner : '', colors: c ? c.colors.slice() : [], owner: c ? c.owner : opts.owner || '' };
    const stats = c ? commanderStats().get(c.id) : null;
    const recent = c ? data.games.filter((g) => g.players.some((p) => p.commanderId === c.id)).slice(0, 5) : [];
    const ov = openSheet(`<div class="sheet-head"><h2>${c ? 'Edit commander' : 'New commander'}</h2><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body">
        <div class="field"><label>Commander name</label><input type="text" data-f="name" value="${esc(st.name)}" placeholder="e.g. Atraxa, Praetors' Voice" autocapitalize="words" maxlength="80"></div>
        <div class="field"><label>Partner / background <span class="muted">(optional)</span></label><input type="text" data-f="partner" value="${esc(st.partner)}" placeholder="Second commander, if any" autocapitalize="words" maxlength="80"></div>
        <div class="field"><label>Color identity</label><div class="color-toggles">${WUBRG.map((x) => `<button class="ctog pip-${x} ${st.colors.includes(x) ? 'on' : ''}" data-color="${x}" aria-label="${COLOR_NAME[x]}">${x}</button>`).join('')}</div><div class="muted small">None selected = colorless</div></div>
        <div class="field"><label>Owner / player <span class="muted">(optional)</span></label><input type="text" data-f="owner" list="owner-names" value="${esc(st.owner)}" placeholder="Who plays this deck" autocapitalize="words" maxlength="40">
          <datalist id="owner-names">${knownPlayers().map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
        ${stats ? `<div class="mini-stats"><div><b>${stats.games}</b><span>games</span></div><div><b>${stats.wins}</b><span>wins</span></div><div><b>${pct(stats.wins, stats.games)}</b><span>win rate</span></div><div><b>${fmtDur(stats.dur / stats.games)}</b><span>avg game</span></div></div>` : ''}
        ${recent.length ? `<div class="sec-title">Recent games</div>${recent.map((g) => { const me = g.players.find((p) => p.commanderId === c.id); return `<div class="recent-row"><span>${fmtShort(g.endedAt)}</span><span class="ellipsis">${me.isWinner ? '🏆 Won' : ordinal(me.place || g.players.length)} · ${g.playerCount}p${g.turns ? ' · T' + g.turns : ''}</span><span class="muted">${fmtDur(g.durationMs)}</span></div>`; }).join('')}` : ''}
        <div class="sheet-actions">${c ? '<button class="btn danger-text" data-a="delete">Delete</button>' : ''}<button class="btn primary grow" data-a="save">${c ? 'Save' : 'Add commander'}</button></div>
      </div>`, { cls: 'tall' });
    ov.addEventListener('click', async (e) => {
      const tog = e.target.closest('[data-color]');
      if (tog) {
        const x = tog.dataset.color; st.colors = st.colors.includes(x) ? st.colors.filter((y) => y !== x) : WUBRG.filter((y) => y === x || st.colors.includes(y));
        tog.classList.toggle('on', st.colors.includes(x)); return;
      }
      const a = e.target.closest('[data-a]'); if (!a) return;
      $$('[data-f]', ov).forEach((inp) => { st[inp.dataset.f] = inp.value.trim(); });
      if (a.dataset.a === 'save') {
        if (!st.name) { toast('Please enter a commander name'); return; }
        let cmd = c;
        if (cmd) Object.assign(cmd, st); else { cmd = sanitizeCommander({ ...st, id: uid(), createdAt: Date.now() }); data.commanders.push(cmd); }
        save(true); closeOverlay(ov); toast(c ? 'Commander updated' : 'Commander added');
        if (opts.onSave) opts.onSave(cmd); else renderTab();
      } else if (a.dataset.a === 'delete') {
        if (!(await confirmDialog(`Delete <b>${esc(c.name)}</b>? Past games keep their record, but it won't show in the commanders list.`, 'Delete', true))) return;
        data.commanders = data.commanders.filter((x) => x.id !== c.id);
        if (data.lastSetup) data.lastSetup.seats.forEach((s) => { if (s.commanderId === c.id) s.commanderId = null; });
        save(true); closeOverlay(ov); renderTab(); toast('Commander deleted');
      }
    });
  }

  async function startGame() {
    if (data.current && !(await confirmDialog('A game is in progress. Discard it and start a new one?', 'Discard & start', true))) return;
    const s = getSetup();
    const players = s.seats.slice(0, s.count).map((seat, i) => {
      const c = getCmd(seat.commanderId);
      return {
        id: 'p' + i, seat: i, name: seat.name.trim() || `Player ${i + 1}`,
        commanderId: c ? c.id : null, commanderName: c ? c.name : '', partnerName: c ? c.partner : '', colors: c ? c.colors.slice() : [],
        life: s.life, poison: 0, cmd: {}, tax: [0, 0], eliminated: false, elimOrder: null, elimReason: null, killedBy: null,
      };
    });
    data.current = { id: uid(), startedAt: Date.now(), startingLife: s.life, players, monarch: null, initiative: null, firstPlayerId: null };
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
    clearInterval(clockTimer); clockTimer = setInterval(updateCenter, 1000);
  }
  function closeGame() {
    $('#game').hidden = true; $('#app').hidden = false; $('#game').innerHTML = '';
    document.body.classList.remove('in-game');
    clearInterval(clockTimer); releaseWakeLock(); renderTab();
  }
  function renderGame() {
    const g = G(); const L = LAYOUTS[g.players.length];
    $('#game').innerHTML = `<div id="board" class="n${g.players.length}" style="grid-template-rows:repeat(${L.rows},1fr);grid-template-columns:repeat(${L.cols},1fr)">
      ${g.players.map((p, i) => {
        const [r, c, span, rot] = L.seats[i];
        return `<div class="cell" style="grid-area:${r}/${c}/span 1/span ${span}"><div class="panel seat-${p.seat} ${Math.abs(rot) === 90 ? 'side' : ''} ${nearClass(L, r, c, span, rot)}" style="--rot:${rot}deg;${safePad(L, r, c, span, rot)}" data-pid="${p.id}" data-rot="${rot}">
          <div class="zone plus" data-d="1"></div><div class="zone minus" data-d="-1"></div>
          <div class="p-head"><div class="p-name"></div><div class="p-cmd"></div></div>
          <button class="p-more" data-act="playerSheet" aria-label="Commander damage & counters">${I.more}</button>
          <div class="p-center"><button class="lbtn" data-d="-1" aria-label="Lose life">−</button><div class="p-life-box"><div class="p-delta"></div><div class="p-life"></div></div><button class="lbtn" data-d="1" aria-label="Gain life">+</button></div>
          <div class="p-foot"><div class="chips"></div></div>
          <div class="p-dead"><div class="skull">☠</div><div class="p-dead-txt"></div></div>
        </div></div>`;
      }).join('')}
      <button id="center-btn" data-act="gameMenu" aria-label="Game menu"><span class="cb-clock"></span><span class="cb-menu">${I.more}</span></button>
    </div>`;
    const board = $('#board');
    board.addEventListener('pointerdown', onPressStart);
    board.addEventListener('touchstart', (e) => { if (e.target.closest('[data-d]')) e.preventDefault(); }, { passive: false });
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    updateAllPanels(); updateCenter();
  }
  // Safe-area insets become inner padding, mapped from screen edges to the panel's own (rotated) edges
  function safePad(L, r, c, span, rot) {
    const scr = { t: r === 1 ? 'var(--sat)' : '0px', b: r === L.rows ? 'var(--sab)' : '0px', l: c === 1 ? 'var(--sal)' : '0px', r: c - 1 + span === L.cols ? 'var(--sar)' : '0px' };
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
      pr.long = true; changeLife(pr.pid, pr.d * 10);
      pr.rep = setInterval(() => changeLife(pr.pid, pr.d * 10), 650);
    }, 450);
    presses.set(e.pointerId, pr);
  }
  function endPress(id, cancel) {
    const pr = presses.get(id); if (!pr) return;
    presses.delete(id); clearTimeout(pr.timer); clearInterval(pr.rep); pr.el.classList.remove('pressed');
    if (!pr.long && !cancel && data.current) changeLife(pr.pid, pr.d);
  }
  window.addEventListener('pointerup', (e) => endPress(e.pointerId, false));
  window.addEventListener('pointercancel', (e) => endPress(e.pointerId, true));

  const panelEl = (pid) => $(`#board .panel[data-pid="${pid}"]`);
  function updateAllPanels() { if (data.current) data.current.players.forEach(updatePanel); }
  function updatePanel(p) {
    const el = panelEl(p.id); if (!el) return; const g = G();
    el.querySelector('.p-name').textContent = p.name;
    el.querySelector('.p-cmd').innerHTML = p.commanderName ? `<span class="pips">${pips(p.colors)}</span><span class="ellipsis">${esc(p.commanderName)}${p.partnerName ? ' + ' + esc(p.partnerName) : ''}</span>` : '';
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
      out.push(`<span class="chip cd seat-${o.seat} ${v >= 21 ? 'lethal' : v >= 15 ? 'warn' : ''}" data-act="playerSheet"><i></i>${I.sword}${v}${idx === '1' ? '<sup>P</sup>' : ''}</span>`);
    }
    if (p.poison) out.push(`<span class="chip poison ${p.poison >= 7 ? 'warn' : ''}" data-act="playerSheet">☣ ${p.poison}</span>`);
    if (p.tax[0] || p.tax[1]) out.push(`<span class="chip tax" data-act="playerSheet">Tax +${p.tax[0] * 2}${p.partnerName ? '/+' + p.tax[1] * 2 : ''}</span>`);
    if (g.monarch === p.id) out.push('<span class="chip crown">👑 Monarch</span>');
    if (g.initiative === p.id) out.push('<span class="chip init">🏰 Initiative</span>');
    return out.join('');
  }
  function updateCenter() {
    const g = G(); const b = $('#center-btn'); if (!g || !b) return;
    b.querySelector('.cb-clock').textContent = fmtClock(Date.now() - g.startedAt);
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
  function changeLife(pid, d) { const p = P(pid); if (!p) return; p.life += d; bumpDelta(p, d); changed(p); }
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
    const steps = alive.length * 3 + alive.indexOf(winner);
    let i = 0;
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
    const g = G(); const p = P(pid); const rot = +(panelEl(pid).dataset.rot || 0);
    const ov = openSheet(`<div class="sheet-head"><div class="sh-l"><span class="seat-dot seat-${p.seat}"></span><div class="sh-t"><h2>${esc(p.name)}</h2><div class="muted small ellipsis">${p.commanderName ? `<span class="pips">${pips(p.colors)}</span> ${esc(p.commanderName)}${p.partnerName ? ' + ' + esc(p.partnerName) : ''}` : 'No commander'}</div></div></div>
      <div class="sh-life"><span data-role="life"></span><small>life</small></div><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body" data-role="body"></div>`, { rot, cls: 'player-sheet' });
    const body = ov.querySelector('[data-role=body]');
    const draw = () => { body.innerHTML = playerSheetBody(p); ov.querySelector('[data-role=life]').textContent = p.life; };
    ov._refresh = draw;
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-pa]'); if (!b) return;
      const a = b.dataset.pa; const d = +b.dataset.d || 0;
      if (a === 'cmd') changeCmd(p, b.dataset.k, d);
      else if (a === 'poison') changePoison(p, d);
      else if (a === 'tax') changeTax(p, +b.dataset.i, d);
      else if (a === 'life') changeLife(p.id, d);
      else if (a === 'monarch' || a === 'initiative') { g[a] = g[a] === p.id ? null : p.id; updateAllPanels(); save(); }
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
  function counterRow(label, val, attrs, cls = '', max = '') {
    return `<div class="cnt-row ${cls}">${label}<button class="cbtn" ${attrs} data-d="-1" aria-label="minus">−</button><span class="cnt-val">${val}${max ? `<small>/${max}</small>` : ''}</span><button class="cbtn plus" ${attrs} data-d="1" aria-label="plus">+</button></div>`;
  }
  function playerSheetBody(p) {
    const g = G(); const opps = g.players.filter((o) => o.id !== p.id);
    const cmdRows = opps.map((o) => {
      const srcs = [o.commanderName || 'Commander']; if (o.partnerName) srcs.push(o.partnerName);
      return srcs.map((nm, idx) => {
        const k = o.id + ':' + idx; const v = p.cmd[k] || 0;
        return counterRow(`<span class="seat-dot sm seat-${o.seat}"></span><div class="cnt-label"><b>${esc(o.name)}</b><small>${esc(nm)}</small></div>`, v, `data-pa="cmd" data-k="${k}"`, v >= 21 ? 'lethal' : v >= 15 ? 'warn' : '');
      }).join('');
    }).join('');
    const taxRows = [p.commanderName || 'Commander'].concat(p.partnerName ? [p.partnerName] : []).map((nm, i) =>
      counterRow(`<span class="cnt-ico">⟳</span><div class="cnt-label"><b>Casts: ${esc(nm)}</b><small>Tax +${p.tax[i] * 2}</small></div>`, p.tax[i], `data-pa="tax" data-i="${i}"`)).join('');
    return `<div class="ps-grid">
      <section><div class="sec-title">Commander damage taken</div>${cmdRows}<p class="hint">Also reduces life. 21 from a single commander is lethal.</p></section>
      <section><div class="sec-title">Life & counters</div>
        ${counterRow('<span class="cnt-ico">♥</span><div class="cnt-label"><b>Life</b><small>adjust by 1</small></div>', p.life, 'data-pa="life"')}
        ${counterRow('<span class="cnt-ico">☣</span><div class="cnt-label"><b>Poison</b><small>10 = loss</small></div>', p.poison, 'data-pa="poison"', p.poison >= 10 ? 'lethal' : p.poison >= 7 ? 'warn' : '', 10)}
        ${taxRows}
        <div class="toggle-row"><button class="tbtn ${g.monarch === p.id ? 'on' : ''}" data-pa="monarch">👑 Monarch</button><button class="tbtn ${g.initiative === p.id ? 'on' : ''}" data-pa="initiative">🏰 Initiative</button></div>
        ${p.eliminated ? `<div class="out-note">☠ Out ${ordinal(p.elimOrder)} · ${REASON[p.elimReason]}</div>` : ''}
        <button class="btn block ${p.eliminated ? '' : 'danger-outline'}" data-pa="concede">${p.eliminated ? 'Revive player' : 'Concede / eliminate'}</button>
      </section></div>`;
  }

  function openGameMenu() {
    const g = G();
    const ov = openSheet(`<div class="sheet-head"><div><h2>Game menu</h2><div class="muted small" data-role="sub"></div></div><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body">
        <div class="menu-grid">
          <button class="mtile" data-ga="first"><b>🎯</b><span>Random first player</span></button>
          <button class="mtile" data-ga="d6"><b>🎲</b><span>Roll d6</span></button>
          <button class="mtile" data-ga="d20"><b>⬢</b><span>Roll d20</span></button>
          <button class="mtile" data-ga="coin"><b>🪙</b><span>Flip coin</span></button>
        </div>
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
      else if (a === 'd6' || a === 'd20' || a === 'coin') showRoll(a);
      else if (a === 'end') { closeOverlay(ov); openEndGame(); }
      else if (a === 'exit') { closeOverlay(ov); closeGame(); }
      else if (a === 'restart') {
        if (!(await confirmDialog('Restart with the same players? Life and counters reset; this game is not saved.', 'Restart', true))) return;
        closeOverlay(ov);
        g.players.forEach((p) => Object.assign(p, { life: g.startingLife, poison: 0, cmd: {}, tax: [0, 0], eliminated: false, elimOrder: null, elimReason: null, killedBy: null }));
        Object.assign(g, { id: uid(), startedAt: Date.now(), monarch: null, initiative: null });
        save(true); renderGame();
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
    const ov = openSheet(`<div class="sheet-head"><h2>End game</h2><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body">
        <div class="field turns-q"><label>How many turns did the game take?</label>
          <div class="stepper"><button class="cbtn" data-step="-1" aria-label="fewer turns">−</button><input type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="999" data-f="turns" placeholder="?"><button class="cbtn plus" data-step="1" aria-label="more turns">+</button></div>
          <div class="muted small">Leave blank if unknown.</div></div>
        <div class="field dur-field"><label>Duration (minutes)</label><input type="number" inputmode="numeric" min="1" max="1440" data-f="mins" value="${mins}"></div>
        <div class="sec-title">Who won?</div><div class="win-list" data-role="list"></div>
        <button class="btn primary big block" data-role="save">Save game</button>
      </div>`, { cls: 'tall' });
    ov.classList.add('end-open');
    const list = ov.querySelector('[data-role=list]');
    const draw = () => {
      const sorted = g.players.slice().sort((a, b) => (a.eliminated - b.eliminated) || ((b.elimOrder || 0) - (a.elimOrder || 0)));
      list.innerHTML = sorted.map((p) => `<button class="win-row ${winner === p.id ? 'on' : ''}" data-w="${p.id}"><span class="seat-dot sm seat-${p.seat}"></span>
        <span class="pr-main"><b>${esc(p.name)}</b><small>${p.commanderName ? pips(p.colors) + ' ' + esc(p.commanderName) : 'No commander'}</small></span>
        <span class="win-status">${p.eliminated ? `Out ${ordinal(p.elimOrder)}<small>${REASON[p.elimReason]}</small>` : `${p.life} life`}</span><span class="radio"></span></button>`).join('')
        + `<button class="win-row draw ${winner === 'draw' ? 'on' : ''}" data-w="draw"><span class="pr-main"><b>No winner / draw</b></span><span class="radio"></span></button>`;
      ov.querySelector('[data-role=save]').disabled = !winner;
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; winner = b.dataset.w; draw(); });
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
      closeOverlay(ov); saveGame(winner === 'draw' ? null : winner, m, t);
    });
    draw();
  }
  function typicalTurns() {
    const ts = data.games.map((g) => g.turns).filter((t) => t > 0);
    return ts.length ? Math.round(ts.reduce((a, b) => a + b, 0) / ts.length) : 8;
  }
  function saveGame(winnerId, mins, turns) {
    const g = G(); const winner = winnerId ? P(winnerId) : null;
    const rest = g.players.filter((p) => p !== winner);
    const ranking = [...(winner ? [winner] : []), ...rest.filter((p) => !p.eliminated), ...rest.filter((p) => p.eliminated).sort((a, b) => b.elimOrder - a.elimOrder)];
    const idxOf = (pid) => g.players.findIndex((x) => x.id === pid);
    const rec = {
      id: g.id, startedAt: g.startedAt, endedAt: Date.now(), durationMs: mins * 60000, turns, startingLife: g.startingLife,
      playerCount: g.players.length, winnerIndex: winner ? idxOf(winner.id) : null,
      players: g.players.map((p) => ({
        name: p.name, commanderId: p.commanderId, commanderName: p.commanderName, partnerName: p.partnerName, colors: p.colors, seat: p.seat,
        finalLife: p.life, poison: p.poison, maxCmdTaken: Math.max(0, ...Object.values(p.cmd)), casts: p.tax[0] + p.tax[1],
        eliminated: p.eliminated, elimOrder: p.elimOrder, elimReason: p.elimReason,
        killedBy: p.killedBy ? idxOf(p.killedBy) : null, isWinner: p === winner, wentFirst: g.firstPlayerId === p.id, place: ranking.indexOf(p) + 1,
      })),
    };
    data.games.unshift(rec); data.current = null; save(true);
    closeGame(); showResult(rec);
  }
  function showResult(rec) {
    const w = rec.winnerIndex != null ? rec.players[rec.winnerIndex] : null;
    const ov = openSheet(`<div class="dialog-body center"><div class="trophy-big">🏆</div>
      <h2>${w ? esc(w.name) + ' wins!' : 'Draw'}</h2>${w && w.commanderName ? `<div class="muted"><span class="pips">${pips(w.colors)}</span> ${esc(w.commanderName)}${w.partnerName ? ' + ' + esc(w.partnerName) : ''}</div>` : ''}
      <div class="muted small">${fmtDur(rec.durationMs)}${rec.turns ? ` · ${rec.turns} turns` : ''} · saved to history</div>
      <div class="dialog-actions"><button class="btn primary" data-r="rematch">Rematch</button><button class="btn" data-r="stats">View stats</button><button class="btn ghost" data-close>Done</button></div></div>`, { dialog: true });
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return; closeOverlay(ov);
      if (b.dataset.r === 'rematch') startGame(); else setTab('stats');
    });
  }

  // ---------- stats ----------
  function lastPlayedMap() {
    const m = new Map(); data.games.forEach((g) => g.players.forEach((p) => { if (p.commanderId) m.set(p.commanderId, Math.max(m.get(p.commanderId) || 0, g.endedAt)); })); return m;
  }
  function commanderStats() {
    const m = new Map();
    for (const g of data.games) {
      g.players.forEach((p) => {
        if (!p.commanderId) return;
        let s = m.get(p.commanderId);
        if (!s) { s = { games: 0, wins: 0, dur: 0, turns: 0, last: 0, placeSum: 0, kills: 0 }; m.set(p.commanderId, s); }
        s.games++; if (p.isWinner) s.wins++; s.dur += g.durationMs || 0; s.turns += g.turns || 0; s.last = Math.max(s.last, g.endedAt); s.placeSum += p.place || 0;
      });
      g.players.forEach((p) => { if (p.killedBy != null && g.players[p.killedBy]) { const k = m.get(g.players[p.killedBy].commanderId); if (k) k.kills++; } });
    }
    return m;
  }
  function renderCommanders(v) {
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
      ${list.length ? list.map(({ c, s }) => `<button class="cmd-card" data-act="editCmd" data-id="${c.id}">
          <div class="cc-top"><span class="pips lg">${pips(c.colors)}</span><div class="cc-name"><b>${esc(c.name)}</b>${c.partner ? `<small>+ ${esc(c.partner)}</small>` : ''}${c.owner ? `<small class="owner">${esc(c.owner)}</small>` : ''}</div>
          <div class="cc-wr"><b>${pct(s.wins, s.games)}</b><small>win rate</small></div></div>
          <div class="bar"><i style="width:${s.games ? Math.round((s.wins / s.games) * 100) : 0}%"></i></div>
          <div class="cc-stats"><span><b>${s.games}</b> game${s.games === 1 ? '' : 's'}</span><span><b>${s.wins}</b> win${s.wins === 1 ? '' : 's'}</span><span><b>${s.games ? fmtDur(s.dur / s.games) : '—'}</b> avg</span>${s.kills ? `<span><b>${s.kills}</b> cmdr kills</span>` : ''}<span>${s.last ? 'Last ' + fmtShort(s.last) : 'Never played'}</span></div>
        </button>`).join('') : `<div class="empty"><div class="empty-ico">🛡️</div><p>No commanders yet.</p><p class="muted small">Add your decks here, or create them when setting up a game.</p><button class="btn primary" data-act="newCmd">Add your first commander</button></div>`}`;
  }
  function renderStats(v) {
    const games = data.games;
    if (!games.length) {
      v.innerHTML = `<header class="page-head"><div><div class="eyebrow">Overview</div><h1>Stats</h1></div></header><div class="empty"><div class="empty-ico">📊</div><p>No games recorded yet.</p><p class="muted small">Finish a game with “End game & save” to see stats here.</p></div>`;
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
    let firstGames = 0, firstWins = 0;
    games.forEach((g) => {
      g.players.forEach((p) => {
        if (p.commanderName) {
          const label = p.partnerName ? `${p.commanderName} + ${p.partnerName}` : p.commanderName;
          const k = p.commanderId || 'name:' + label.toLowerCase();
          const live = getCmd(p.commanderId);
          const e = byCmd.get(k) || { label: live ? cmdLabel(live) : label, colors: live ? live.colors : p.colors, g: 0, w: 0 };
          e.g++; if (p.isWinner) e.w++; byCmd.set(k, e);
          const colors = live ? live.colors : p.colors || [];
          (colors.length ? colors : ['C']).forEach((c) => { colorStats[c].g++; if (p.isWinner) colorStats[c].w++; });
          countStats[colors.length].g++; if (p.isWinner) countStats[colors.length].w++;
        }
        const pk = p.name.trim().toLowerCase();
        const pe = byPlayer.get(pk) || { name: p.name, g: 0, w: 0, placeSum: 0, cmds: new Map() };
        pe.g++; if (p.isWinner) pe.w++; pe.placeSum += p.place || g.playerCount;
        if (p.commanderName) pe.cmds.set(p.commanderName, (pe.cmds.get(p.commanderName) || 0) + 1);
        byPlayer.set(pk, pe);
        if (p.eliminated && reasons[p.elimReason] != null) reasons[p.elimReason]++;
        if (p.wentFirst) { firstGames++; if (p.isWinner) firstWins++; }
      });
    });
    const cmds = [...byCmd.values()];
    const most = cmds.slice().sort((a, b) => b.g - a.g || b.w - a.w)[0];
    const minG = cmds.some((c) => c.g >= 3) ? 3 : 1;
    const best = cmds.filter((c) => c.g >= minG).sort((a, b) => b.w / b.g - a.w / a.g || b.g - a.g)[0];
    const longest = games.reduce((a, g) => (g.durationMs > a.durationMs ? g : a), games[0]);
    const shortest = games.reduce((a, g) => (g.durationMs < a.durationMs ? g : a), games[0]);
    const fastest = games.filter((g) => g.winnerIndex != null && g.turns > 0).reduce((a, g) => (!a || g.turns < a.turns ? g : a), null);
    const bar = (label, pre, s) => `<div class="bar-row">${pre}<span class="bar-label">${label}</span><div class="bar"><i style="width:${s.g ? Math.round((s.w / s.g) * 100) : 0}%"></i></div><span class="bar-val">${pct(s.w, s.g)}<small>${s.w}/${s.g}</small></span></div>`;
    const avgP = totalPlayers / n;
    const reasonTotal = Object.values(reasons).reduce((a, b) => a + b, 0);
    const players = [...byPlayer.values()].sort((a, b) => b.g - a.g || b.w - a.w);
    const winnerOf = (g) => g.players[g.winnerIndex];
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">Overview</div><h1>Stats</h1></div></header>
      <div class="tiles">
        <div class="tile"><b>${n}</b><span>games played</span></div>
        <div class="tile"><b>${fmtDur(totalDur / n)}</b><span>avg duration</span></div>
        <div class="tile"><b>${turnGames.length ? (totalTurns / turnGames.length).toFixed(1) : '—'}</b><span>avg turns</span></div>
        <div class="tile"><b>${fmtDur(totalDur)}</b><span>total time played</span></div>
        <div class="tile"><b>${avgP.toFixed(1)}</b><span>avg players</span></div>
        <div class="tile"><b>${firstGames ? pct(firstWins, firstGames) : '—'}</b><span>first-player win rate</span></div>
      </div>
      <section class="card"><div class="card-title">Highlights</div>
        ${most ? `<div class="hl-row"><span class="muted">Most played</span><span class="hl-v"><span class="pips">${pips(most.colors)}</span> ${esc(most.label)} <small>${most.g} game${most.g === 1 ? '' : 's'}</small></span></div>` : ''}
        ${best ? `<div class="hl-row"><span class="muted">Best win rate${minG > 1 ? ' (3+ games)' : ''}</span><span class="hl-v"><span class="pips">${pips(best.colors)}</span> ${esc(best.label)} <small>${pct(best.w, best.g)}</small></span></div>` : ''}
        ${fastest ? `<div class="hl-row"><span class="muted">Fastest win</span><span class="hl-v">${esc(winnerOf(fastest).name)} <small>turn ${fastest.turns} · ${fmtShort(fastest.endedAt)}</small></span></div>` : ''}
        <div class="hl-row"><span class="muted">Longest game</span><span class="hl-v">${fmtDur(longest.durationMs)} <small>${fmtShort(longest.endedAt)}</small></span></div>
        <div class="hl-row"><span class="muted">Shortest game</span><span class="hl-v">${fmtDur(shortest.durationMs)} <small>${fmtShort(shortest.endedAt)}</small></span></div>
      </section>
      <section class="card"><div class="card-title">Players</div>
        <div class="ptable"><div class="pt-head"><span>Player</span><span>G</span><span>W</span><span>Win%</span><span>Avg pl.</span></div>
        ${players.map((p) => { const fav = [...p.cmds.entries()].sort((a, b) => b[1] - a[1])[0]; return `<div class="pt-row"><span class="pt-name"><b>${esc(p.name)}</b>${fav ? `<small>${esc(fav[0])}</small>` : ''}</span><span>${p.g}</span><span>${p.w}</span><span class="acc">${pct(p.w, p.g)}</span><span>${(p.placeSum / p.g).toFixed(1)}</span></div>`; }).join('')}</div>
      </section>
      <section class="card"><div class="card-title">Win rate by color <span class="muted small">baseline ≈ ${Math.round(100 / avgP)}%</span></div>
        ${WUBRG.concat('C').map((c) => bar(COLOR_NAME[c], `<span class="pip pip-${c}"></span>`, colorStats[c])).join('')}
      </section>
      <section class="card"><div class="card-title">Win rate by number of colors</div>
        ${['Colorless', 'Mono', 'Two-color', 'Three-color', 'Four-color', 'Five-color'].map((l, i) => (countStats[i].g ? bar(l, '', countStats[i]) : '')).join('')}
      </section>
      <section class="card"><div class="card-title">Commanders</div>
        ${cmds.sort((a, b) => b.g - a.g || b.w - a.w).map((c) => bar(esc(c.label), `<span class="pips">${pips(c.colors)}</span>`, c)).join('')}
      </section>
      ${reasonTotal ? `<section class="card"><div class="card-title">How players were eliminated</div>
        ${Object.entries(reasons).filter(([, c]) => c).map(([r, c]) => `<div class="bar-row"><span class="bar-label">${REASON[r][0].toUpperCase() + REASON[r].slice(1)}</span><div class="bar alt"><i style="width:${Math.round((c / reasonTotal) * 100)}%"></i></div><span class="bar-val">${c}</span></div>`).join('')}
      </section>` : ''}`;
  }
  function renderHistory(v) {
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">${data.games.length} game${data.games.length === 1 ? '' : 's'}</div><h1>History</h1></div></header>
      ${data.games.length ? data.games.map((g) => {
        const ps = g.players.slice().sort((a, b) => (a.place || 99) - (b.place || 99));
        const w = g.winnerIndex != null ? g.players[g.winnerIndex] : null;
        return `<div class="card game-card"><div class="gc-head"><div><b>${fmtDate(g.endedAt)}</b> <span class="muted small">${fmtTime(g.startedAt)}</span><div class="muted small">${g.playerCount} players · ${fmtDur(g.durationMs)}${g.turns ? ` · ${g.turns} turns` : ''} · ${g.startingLife} life</div></div>
          <button class="icon-btn danger" data-act="deleteGame" data-id="${g.id}" aria-label="Delete game">${I.trash}</button></div>
          <div class="gc-winner">${w ? `🏆 <b>${esc(w.name)}</b> ${w.commanderName ? `<span class="pips">${pips(w.colors)}</span> ${esc(w.commanderName)}` : ''}` : '<b>Draw</b>'}</div>
          <div class="gc-players">${ps.map((p) => `<div class="gc-p ${p.isWinner ? 'win' : ''}"><span class="gc-place">${p.place ? ordinal(p.place) : ''}</span><span class="ellipsis"><b>${esc(p.name)}</b> ${p.commanderName ? '· ' + esc(p.commanderName) : ''}</span><span class="muted small nowrap">${p.eliminated ? REASON[p.elimReason] : p.finalLife + ' ♥'}${p.wentFirst ? ' · went 1st' : ''}</span></div>`).join('')}</div></div>`;
      }).join('') : '<div class="empty"><div class="empty-ico">🕰️</div><p>No games yet.</p><p class="muted small">Saved games appear here. You can delete a wrong entry anytime.</p></div>'}`;
  }

  // ---------- settings / backup ----------
  function renderSettings(v) {
    const s = data.settings;
    const size = new Blob([localStorage.getItem(STORE_KEY) || '']).size;
    v.innerHTML = `<header class="page-head"><div><div class="eyebrow">Commander Tracker ${APP_VERSION}</div><h1>Settings</h1></div></header>
      <section class="card"><div class="card-title">Defaults</div>
        <div class="field"><label>Default starting life</label><div class="seg">${LIFE_PRESETS.map((n) => `<button data-act="defLife" data-v="${n}" class="${s.startingLife === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Default players</label><div class="seg">${[2, 3, 4, 5, 6].map((n) => `<button data-act="defCount" data-v="${n}" class="${s.playerCount === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <label class="switch-row"><span>Keep screen awake during games${'wakeLock' in navigator ? '' : ' <small class="muted">(not supported here)</small>'}</span><input type="checkbox" data-bind="wakeLock" ${s.wakeLock ? 'checked' : ''}><i class="switch"></i></label>
        <label class="switch-row"><span>Random first player at start</span><input type="checkbox" data-bind="randomFirst" ${s.randomFirst ? 'checked' : ''}><i class="switch"></i></label>
      </section>
      <section class="card"><div class="card-title">Backup</div>
        <p class="muted small">All data is stored only on this device (${data.commanders.length} commanders, ${data.games.length} games, ${(size / 1024).toFixed(1)} KB). Export a backup regularly — e.g. save it to Files or iCloud Drive.</p>
        <div class="row2"><button class="btn primary" data-act="exportData">Export JSON</button><label class="btn">Import JSON<input type="file" accept="application/json,.json" data-bind="importFile" hidden></label></div>
        <button class="btn ghost block" data-act="copyData">Copy backup to clipboard</button>
      </section>
      <section class="card"><div class="card-title">Danger zone</div><button class="btn danger-outline block" data-act="wipeData">Delete all data</button></section>
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
    const inc = normalize(obj);
    if (mode === 'replace') { data = inc; }
    else {
      const cids = new Set(data.commanders.map((c) => c.id)); inc.commanders.forEach((c) => { if (!cids.has(c.id)) data.commanders.push(c); });
      const gids = new Set(data.games.map((g) => g.id)); inc.games.forEach((g) => { if (!gids.has(g.id)) data.games.push(g); });
      data.games.sort((a, b) => b.endedAt - a.endedAt);
    }
    save(true); renderTab(); toast(mode === 'replace' ? 'Data replaced from backup' : 'Backup merged');
  }

  // ---------- wake lock ----------
  let wakeLock = null;
  async function requestWakeLock() {
    if (!data.settings.wakeLock || !('wakeLock' in navigator) || $('#game').hidden || document.hidden || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

  // ---------- event wiring ----------
  const ACTIONS = {
    tab: (el) => setTab(el.dataset.tab),
    setCount: (el) => { getSetup().count = +el.dataset.v; save(); renderTab(); },
    setLife: (el) => { getSetup().life = +el.dataset.v; save(); renderTab(); },
    pickCmd: (el) => openCmdPicker(+el.dataset.i),
    startGame: () => startGame(),
    resumeGame: () => openGame(),
    discardGame: async () => { if (await confirmDialog('Discard the game in progress?', 'Discard', true)) { data.current = null; save(true); renderTab(); } },
    newCmd: () => openCmdEditor(null),
    editCmd: (el) => openCmdEditor(el.dataset.id),
    cmdSort: (el) => { cmdSort = el.dataset.v; renderTab(); },
    deleteGame: async (el) => {
      const g = data.games.find((x) => x.id === el.dataset.id); if (!g) return;
      if (!(await confirmDialog(`Delete the game from ${fmtDate(g.endedAt)}? Stats will be recalculated.`, 'Delete', true))) return;
      data.games = data.games.filter((x) => x !== g); save(true); renderTab(); toast('Game deleted');
    },
    defLife: (el) => { data.settings.startingLife = +el.dataset.v; getSetup().life = +el.dataset.v; save(); renderTab(); },
    defCount: (el) => { data.settings.playerCount = +el.dataset.v; getSetup().count = +el.dataset.v; save(); renderTab(); },
    exportData: () => exportData(),
    copyData: async () => { try { await navigator.clipboard.writeText(backupJson()); toast('Backup copied to clipboard'); } catch (e) { toast('Clipboard not available'); } },
    wipeData: async () => {
      if (!(await confirmDialog('Delete <b>all</b> commanders, games and settings from this device? This cannot be undone.', 'Delete everything', true))) return;
      data = defaults(); save(true); renderTab(); toast('All data deleted');
    },
    playerSheet: (el) => { const panel = el.closest('.panel'); if (panel) openPlayerSheet(panel.dataset.pid); },
    gameMenu: () => openGameMenu(),
    displayInfo: () => openDisplayInfo(),
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACTIONS[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
  });
  const BINDS = {
    seatName: (el) => { getSetup().seats[+el.dataset.i].name = el.value; save(); },
    customLife: (el) => {
      const n = parseInt(el.value, 10);
      if (n > 0 && n < 1000) { getSetup().life = n; save(); $$('#life-seg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === n)); el.classList.toggle('on', !LIFE_PRESETS.includes(n)); }
    },
    randomFirst: (el) => { data.settings.randomFirst = el.checked; save(); },
    wakeLock: (el) => { data.settings.wakeLock = el.checked; save(); },
    importFile: (el) => { const f = el.files && el.files[0]; el.value = ''; if (f) importFile(f); },
  };
  const onBind = (e) => {
    const el = e.target; const b = el.dataset && el.dataset.bind; if (!b || !BINDS[b]) return;
    const wants = el.type === 'file' || el.type === 'checkbox' ? 'change' : 'input';
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
    root.style.setProperty('--app-h', h + 'px');
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
      ['Detected unpainted band below', vp.gapBelow + 'px'], ['--app-h (game layer size)', getComputedStyle(root).getPropertyValue('--app-h').trim()],
      ['Effective bottom inset (--sab)', getComputedStyle(root).getPropertyValue('--sab').trim()],
      ['html height', rh(root)], ['body height', rh(document.body)], ['game layer height', gameEl.hidden ? 'hidden (open during a game)' : rh(gameEl)],
      ['User agent', navigator.userAgent],
    ];
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    const ov = openSheet(`<div class="sheet-head"><h2>Display info</h2><button class="icon-btn" data-close>${I.close}</button></div>
      <div class="sheet-body"><p class="muted small">Screenshot this screen to report layout issues.</p>
      <div class="diag">${rows.map(([k, v]) => `<div class="diag-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <button class="btn block" data-role="copy">Copy as text</button></div>`, { cls: 'tall diag-sheet' });
    ov.querySelector('[data-role=copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Clipboard not available'); }
    });
  }

  // ---------- boot ----------
  renderTab();
  if (data.current) openGame();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Fallback when the SW can't navigate this window itself: reload once, after any open dialog closes.
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'sw-updated') return;
      save(true);
      const go = () => { if ($('.overlay')) setTimeout(go, 1500); else location.reload(); };
      go();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('SW registration failed', e)));
  }
  window.__edh = { get data() { return data; } }; // debug/test hook
})();
