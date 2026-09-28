/* Commander Tracker — online playgroups (Supabase). Data + sync layer; UI lives in app.js.
   Works offline: everything is cached in localStorage and finished games are queued until they can be uploaded. */
'use strict';
(function () {
  const SUPABASE_URL = 'https://uxfcidiqagswxkntymmh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Uz-TjHV8-44SKCjd9ncvqg_txEjwjOp'; // publishable (client-safe) key; data is protected by RLS
  // Friends sign in with username + password. Supabase Auth needs an email-shaped identifier, so the username is mapped to
  // an internal address on the app's own domain. No email is ever sent to it (requires "Confirm email" = off).
  const EMAIL_DOMAIN = 'creepyfoxx.github.io';
  const CKEY = 'edh-tracker:cloud';
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  const OAUTH_KEY = 'edh-tracker:oauthStarted';
  // OAuth returns to the app's own start URL (inside the manifest scope, so iOS brings it back into the Home Screen app)
  const APP_URL = new URL('./', location.href).href;
  const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'state', 'sb'];

  // a dead connection can leave requests hanging for minutes: give up after 15 s (the queue retries later)
  function timedFetch(input, init = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    if (init.signal) { if (init.signal.aborted) ctl.abort(); else init.signal.addEventListener('abort', () => ctl.abort()); }
    return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
  }
  const sb = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      // PKCE: the code verifier stays in this app's localStorage, and the ?code= that Google/Supabase send back is
      // exchanged for a session on load (detectSessionInUrl)
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'edh-tracker:auth' },
      global: { fetch: timedFetch },
    })
    : null;

  function blank() { return { user: null, groupId: null, groups: [], byGroup: {}, queue: [], migrated: {}, lastSync: 0, lastError: '' }; }
  let st;
  try { st = Object.assign(blank(), JSON.parse(localStorage.getItem(CKEY) || '{}')); } catch (e) { st = blank(); }
  const persist = () => { try { localStorage.setItem(CKEY, JSON.stringify(st)); } catch (e) { /* storage full */ } };
  const listeners = new Set();
  const emit = () => { persist(); listeners.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } }); };

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const isNetErr = (err) => !err || !err.code || /fetch|network|load failed|timeout/i.test(String(err.message || err));
  const online = () => navigator.onLine !== false;
  // navigator.onLine stays true on a connected-but-dead network (typical bad signal in a store), so also remember
  // whether the last request failed at the network level; the UI uses offline() for its indicator.
  let netDown = false;
  const offline = () => !online() || netDown;
  const noteNet = (err) => { const was = netDown; netDown = err ? isNetErr(err) : false; return was !== netDown; };
  const G = (gid = st.groupId) => (gid && (st.byGroup[gid] || (st.byGroup[gid] = { members: [], decks: [], guests: [], games: [], fetchedAt: 0 })));
  function friendlyError(err) {
    const m = String((err && (err.message || err.msg)) || err || 'Something went wrong');
    if (/invalid login credentials/i.test(m)) return 'Wrong username or password.';
    if (/already registered|already exists/i.test(m)) return 'That username is taken.';
    if (/password should be at least/i.test(m)) return 'Password must be at least 6 characters.';
    if (/invalid invite code/i.test(m)) return 'Invite code not found.';
    if (/email not confirmed/i.test(m)) return 'This account is waiting for email confirmation (server setting). Ask the group admin.';
    if (/rate limit/i.test(m)) return 'Too many attempts — try again in a few minutes.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'Google sign-in is not enabled on the server yet.';
    if (/access_denied|cancel/i.test(m)) return 'Sign-in was cancelled.';
    if (isNetErr(err)) return 'No connection — try again when online.';
    return m;
  }
  function need(cond, msg) { if (!cond) throw new Error(msg); }

  const fromRow = (r) => ({
    id: r.id, groupId: r.group_id, recordedBy: r.recorded_by, startedAt: Date.parse(r.started_at), endedAt: Date.parse(r.ended_at),
    durationMs: r.duration_ms, turns: r.turns, startingLife: r.starting_life, playerCount: r.player_count, winnerIndex: r.winner_index, players: r.players,
    firstPlayerIndex: r.first_player_index ?? null, // v1.5 (null for older games)
  });
  // v1.7 Commander Brackets: each player's bracket travels inside players[] (frozen when the game started);
  // bracket_min / bracket_max summarise the pod for querying (null when nobody had one)
  const normBracket = (b) => { if (b == null || b === '' || typeof b === 'boolean') return null; const n = Number(b); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
  const podRange = (players) => { const bs = (players || []).map((p) => normBracket(p && p.bracket)).filter(Boolean); return bs.length ? [Math.min(...bs), Math.max(...bs)] : [null, null]; };
  const cleanPlayers = (players) => players.map((p) => (p && 'bracket' in p ? { ...p, bracket: normBracket(p.bracket) } : p));
  const toRow = (g, gid) => ({
    id: g.id, group_id: gid, recorded_by: st.user.id, started_at: new Date(g.startedAt).toISOString(), ended_at: new Date(g.endedAt).toISOString(),
    duration_ms: Math.round(g.durationMs || 0), turns: g.turns || null, starting_life: g.startingLife, player_count: g.playerCount,
    winner_index: g.winnerIndex, players: cleanPlayers(g.players),
    bracket_min: podRange(g.players)[0], bracket_max: podRange(g.players)[1],
    // v1.5: who took the first turn (per-player turnPos / solRingT1 travel inside players)
    first_player_index: Number.isInteger(g.firstPlayerIndex) && g.firstPlayerIndex >= 0 && g.firstPlayerIndex < g.playerCount ? g.firstPlayerIndex : null,
  });

  // ---------- auth ----------
  async function loadProfile(uid) {
    const { data, error } = await sb.from('profiles').select('id, username, display_name, color').eq('id', uid).single();
    if (error) throw error;
    let providers = [], email = '';
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) { providers = (session.user.app_metadata && session.user.app_metadata.providers) || []; email = session.user.email || ''; }
    } catch (e) { /* ignore */ }
    st.user = { ...data, providers, email: providers.includes('google') ? email : '' }; emit(); return st.user;
  }
  // ---------- Google (OAuth, PKCE, same-window redirect) ----------
  let googleEnabled = null;
  async function googleAvailable() {
    if (googleEnabled) return true; // only a positive answer is cached, so enabling it server-side works without reload
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
      const j = await r.json(); googleEnabled = !!(j.external && j.external.google);
    } catch (e) { return null; } // unknown (offline)
    return googleEnabled;
  }
  async function googleAuthUrl() {
    const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_URL, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
    if (error) throw new Error(friendlyError(error));
    return data.url;
  }
  async function signInWithGoogle() {
    need(sb, 'Online features unavailable (offline?)');
    need(online(), 'No connection — try again when online.');
    const ok = await googleAvailable();
    if (ok === false) throw new Error('Google sign-in is not enabled on the server yet.');
    const url = await googleAuthUrl(); // stores the PKCE verifier in localStorage
    localStorage.setItem(OAUTH_KEY, String(Date.now()));
    // same window on purpose: in an iOS Home Screen app a popup/new window would open Safari (separate storage);
    // a same-window navigation shows Google in an in-app sheet and the redirect back to APP_URL lands in the app
    location.assign(url);
    return url;
  }
  async function invitePreview(code) { // group name for an invite code (works signed out); null if unknown/offline
    if (!sb || !online()) return null;
    try { const { data, error } = await sb.rpc('invite_preview', { p_code: String(code || '') }); return error ? null : data; } catch (e) { return null; }
  }
  async function setPassword(pw) {
    need(st.user && sb, 'Sign in first');
    need(String(pw || '').length >= 6, 'Password must be at least 6 characters.');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw new Error(friendlyError(error));
  }
  async function signIn(username, password) {
    need(sb, 'Online features unavailable (offline?)');
    const u = String(username || '').trim().toLowerCase();
    const isEmail = u.includes('@'); // Google users who set an app password sign in with their Google email
    need(isEmail || USERNAME_RE.test(u), 'Username: 3–20 letters, numbers or _ (or your email)');
    const { data, error } = await sb.auth.signInWithPassword({ email: isEmail ? u : `${u}@${EMAIL_DOMAIN}`, password });
    if (error) throw new Error(friendlyError(error));
    await loadProfile(data.user.id);
    await refresh();
    return st.user;
  }
  async function signUp(username, password, displayName, color) {
    need(sb, 'Online features unavailable (offline?)');
    const u = String(username || '').trim().toLowerCase();
    need(USERNAME_RE.test(u), 'Username: 3–20 lowercase letters, numbers or _');
    need(String(password || '').length >= 6, 'Password must be at least 6 characters.');
    const { data, error } = await sb.auth.signUp({
      email: `${u}@${EMAIL_DOMAIN}`, password,
      options: { data: { username: u, display_name: String(displayName || u).trim().slice(0, 24), color: color || null } },
    });
    if (error) throw new Error(friendlyError(error));
    if (!data.session) return { needsConfirmation: true };
    await loadProfile(data.user.id);
    await refresh();
    return { user: st.user };
  }
  async function signOut() {
    if (sb) { try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* offline: local sign-out still clears */ } }
    st = { ...blank(), migrated: st.migrated }; // the UI warns first if games are still waiting to upload
    emit();
  }
  async function updateProfile(fields) {
    need(st.user, 'Not signed in');
    const patch = {};
    if (fields.display_name != null) patch.display_name = String(fields.display_name).trim().slice(0, 24) || st.user.username;
    if (fields.color !== undefined) patch.color = fields.color;
    const { error } = await sb.from('profiles').update(patch).eq('id', st.user.id);
    if (error) throw new Error(friendlyError(error));
    Object.assign(st.user, patch);
    Object.values(st.byGroup).forEach((g) => g.members.forEach((m) => { if (m.id === st.user.id) Object.assign(m, patch); }));
    emit();
  }

  // ---------- groups ----------
  async function fetchGroups() {
    const { data, error } = await sb.from('group_members').select('role, groups(id, name, invite_code, created_by)').eq('user_id', st.user.id);
    if (error) throw error;
    st.groups = data.filter((r) => r.groups).map((r) => ({ ...r.groups, role: r.role })).sort((a, b) => a.name.localeCompare(b.name));
    if (!st.groups.some((g) => g.id === st.groupId)) st.groupId = st.groups.length ? st.groups[0].id : null;
  }
  async function fetchGroupData(gid) {
    const g = G(gid);
    const mem = await sb.from('group_members').select('role, joined_at, profiles(id, username, display_name, color)').eq('group_id', gid);
    if (mem.error) throw mem.error;
    g.members = mem.data.filter((r) => r.profiles).map((r) => ({ ...r.profiles, role: r.role })).sort((a, b) => a.display_name.localeCompare(b.display_name));
    const ids = g.members.map((m) => m.id);
    const [decks, guests, games] = await Promise.all([
      ids.length ? sb.from('decks').select('id, owner_id, commander, partner, colors, name, bracket, created_at, updated_at').in('owner_id', ids) : Promise.resolve({ data: [] }),
      sb.from('guests').select('id, name, linked_user_id, created_at').eq('group_id', gid),
      sb.from('games').select('*').eq('group_id', gid).order('ended_at', { ascending: false }).limit(2000),
    ]);
    for (const r of [decks, guests, games]) if (r.error) throw r.error;
    g.decks = decks.data.sort((a, b) => a.commander.localeCompare(b.commander));
    g.guests = guests.data.sort((a, b) => a.name.localeCompare(b.name));
    // keep games that are still waiting in the upload queue, hide ones queued for deletion
    const fetched = games.data.map(fromRow); const have = new Set(fetched.map((x) => x.id));
    const dels = new Set(st.queue.filter((q) => q.type === 'delete').map((q) => q.id));
    const queued = st.queue.filter((q) => q.type === 'game' && q.groupId === gid && !have.has(q.game.id)).map((q) => q.game);
    g.games = [...queued, ...fetched].filter((x) => !dels.has(x.id)).sort((a, b) => b.endedAt - a.endedAt);
    g.fetchedAt = Date.now();
  }
  let refreshing = null;
  function refresh() {
    if (!sb || !st.user || !online()) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        await sync();
        await fetchGroups();
        if (st.groupId) await fetchGroupData(st.groupId);
        noteNet(null); st.lastError = ''; emit(); return true;
      } catch (e) {
        noteNet(e); st.lastError = friendlyError(e);
        if (e && (e.status === 401 || /jwt|refresh token/i.test(String(e.message)))) st.lastError = 'Session expired — please sign in again.';
        emit();
        return false;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }
  async function createGroup(name) {
    need(st.user && sb, 'Sign in first');
    const { data, error } = await sb.rpc('create_group', { p_name: String(name || '').trim() || 'Playgroup' });
    if (error) throw new Error(friendlyError(error));
    st.groupId = data.id; await fetchGroups(); await fetchGroupData(data.id); emit(); return data;
  }
  async function joinGroup(code) {
    need(st.user && sb, 'Sign in first');
    const { data, error } = await sb.rpc('join_group', { p_code: String(code || '').trim().toUpperCase() });
    if (error) throw new Error(friendlyError(error));
    st.groupId = data.id; await fetchGroups(); await fetchGroupData(data.id); emit(); return data;
  }
  async function leaveGroup(gid) {
    const { error } = await sb.from('group_members').delete().eq('group_id', gid).eq('user_id', st.user.id);
    if (error) throw new Error(friendlyError(error));
    delete st.byGroup[gid]; st.queue = st.queue.filter((q) => q.groupId !== gid);
    await fetchGroups(); if (st.groupId) await fetchGroupData(st.groupId); emit();
  }
  function setGroup(gid) { st.groupId = gid; emit(); refresh(); }

  // ---------- decks ----------
  async function saveDeck(deck) {
    need(st.user && sb, 'Sign in first');
    const row = { commander: deck.commander.trim(), partner: (deck.partner || '').trim() || null, colors: deck.colors || [], name: (deck.name || '').trim() || null, updated_at: new Date().toISOString() };
    if ('bracket' in deck) row.bracket = normBracket(deck.bracket); // v1.7; callers that don't know about brackets leave it as is
    const q = deck.id ? sb.from('decks').update(row).eq('id', deck.id).select().single() : sb.from('decks').insert({ ...row, owner_id: st.user.id }).select().single();
    const { data, error } = await q;
    if (error) throw new Error(friendlyError(error));
    Object.values(st.byGroup).forEach((g) => {
      if (!g.members.some((m) => m.id === st.user.id)) return;
      const i = g.decks.findIndex((d) => d.id === data.id); if (i >= 0) g.decks[i] = data; else g.decks.push(data);
    });
    emit(); return data;
  }
  async function deleteDeck(id) {
    const { error } = await sb.from('decks').delete().eq('id', id);
    if (error) throw new Error(friendlyError(error));
    Object.values(st.byGroup).forEach((g) => { g.decks = g.decks.filter((d) => d.id !== id); });
    emit();
  }

  // ---------- games + offline queue ----------
  function queueGame(gid, rec) {
    const game = { ...rec, id: rec.id && /^[0-9a-f-]{36}$/.test(rec.id) ? rec.id : uuid(), groupId: gid, recordedBy: st.user.id };
    st.queue.push({ type: 'game', groupId: gid, game });
    const g = G(gid); g.games = [game, ...g.games.filter((x) => x.id !== game.id)];
    emit(); sync(); return game;
  }
  let inFlight = null; // queue item currently being uploaded
  function deleteGame(id) {
    const qi = st.queue.findIndex((q) => q.type === 'game' && q.game.id === id);
    // not uploaded yet: just drop it. If it is being uploaded right now, let that finish and delete it afterwards.
    if (qi >= 0 && st.queue[qi] !== inFlight) st.queue.splice(qi, 1); else st.queue.push({ type: 'delete', id });
    Object.values(st.byGroup).forEach((g) => { g.games = g.games.filter((x) => x.id !== id); });
    emit(); sync();
  }
  let syncing = null;
  function sync() {
    if (!sb || !st.user || !online() || !st.queue.length) return Promise.resolve(true);
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { st.lastError = 'Signed out — sign in to upload pending games.'; emit(); return false; }
        while (st.queue.length) {
          const item = st.queue[0]; inFlight = item;
          if (item.type === 'game') {
            const game = item.game;
            for (const p of game.players) {
              if (p.kind === 'guest' && !p.guestId && p.name) {
                const { data: gid, error } = await sb.rpc('ensure_guest', { p_group: item.groupId, p_name: p.name });
                if (error) throw error;
                p.guestId = gid;
              }
            }
            const { error } = await sb.from('games').insert(toRow(game, item.groupId));
            if (error && error.code !== '23505') throw error; // 23505 = already uploaded
          } else if (item.type === 'delete') {
            const { error } = await sb.from('games').delete().eq('id', item.id);
            if (error) throw error;
          }
          // remove exactly this item (the queue may have changed while the request was running)
          const done = st.queue.indexOf(item); if (done >= 0) st.queue.splice(done, 1);
          inFlight = null; st.lastSync = Date.now(); st.lastError = ''; noteNet(null); emit();
        }
        return true;
      } catch (e) {
        st.lastError = friendlyError(e); noteNet(e);
        if (!isNetErr(e)) { // a permanent error (e.g. no longer a member): park the item at the end so others can proceed
          const bad = inFlight; const bi = bad ? st.queue.indexOf(bad) : -1;
          if (bi >= 0) {
            st.queue.splice(bi, 1); bad.error = st.lastError; bad.tries = (bad.tries || 0) + 1;
            const deletedMeanwhile = bad.type === 'game' && st.queue.some((q) => q.type === 'delete' && q.id === bad.game.id);
            if (deletedMeanwhile) { /* user deleted it while it was uploading: nothing left to do */ } else if (bad.tries < 5) st.queue.push(bad); else console.warn('dropping unsyncable item', bad);
          }
        }
        emit(); return false;
      } finally { syncing = null; inFlight = null; }
    })();
    return syncing;
  }

  // ---------- migration bookkeeping ----------
  function migrationKey(gid) { return `${st.user && st.user.id}:${gid}`; }

  // ---------- lifecycle ----------
  // Returns what happened with an OAuth redirect on this load:
  // { justSignedIn } | { error } | { wrongPlace } (a ?code= arrived but this app instance never started the sign-in:
  // on iOS that means Google finished in Safari instead of the Home Screen app, or vice versa)
  async function init() {
    if (!sb) return {};
    const q = new URLSearchParams(location.search);
    const hadCode = q.has('code'); const urlErr = q.get('error_description') || q.get('error');
    const started = localStorage.getItem(OAUTH_KEY);
    let initErr = null;
    try { const r = await sb.auth.initialize(); initErr = r && r.error; } catch (e) { initErr = e; }
    sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && st.user) { st = { ...blank(), migrated: st.migrated }; emit(); } });
    const res = {};
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { /* offline */ }
    if (hadCode || urlErr) {
      const consumed = hadCode && !new URLSearchParams(location.search).has('code'); // supabase-js removes it after a successful exchange
      if (consumed && session) res.justSignedIn = true;
      else if (urlErr || initErr) res.error = friendlyError(urlErr || initErr);
      else if (!session) res.wrongPlace = true;
      localStorage.removeItem(OAUTH_KEY);
      const u = new URL(location.href); AUTH_PARAMS.forEach((k) => u.searchParams.delete(k));
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } else if (started && Date.now() - +started > 10 * 60000) localStorage.removeItem(OAUTH_KEY);
    try {
      if (session && (!st.user || st.user.id !== session.user.id || !st.user.providers) && online()) await loadProfile(session.user.id);
      if (!session && st.user && online()) { st = { ...blank(), migrated: st.migrated }; emit(); return res; }
    } catch (e) { if (res.justSignedIn) res.error = friendlyError(e); }
    if (res.justSignedIn) await refresh(); else refresh();
    return res;
  }
  window.addEventListener('online', () => refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // retry pending uploads every 15 s (cheap: nothing happens with an empty queue); after a network failure also
  // re-check the connection so the offline indicator clears by itself
  setInterval(() => { if (st.queue.length) sync(); else if (netDown && st.user) refresh(); }, 15000);

  window.EDHCloud = {
    available: !!sb, uuid, USERNAME_RE,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    init, refresh, sync, signIn, signUp, signOut, updateProfile, signInWithGoogle, googleAuthUrl, googleAvailable, setPassword, invitePreview, APP_URL,
    createGroup, joinGroup, leaveGroup, setGroup, saveDeck, deleteDeck, queueGame, deleteGame,
    user: () => st.user, groupId: () => (st.user ? st.groupId : null), groups: () => st.groups,
    group: () => st.groups.find((g) => g.id === st.groupId) || null,
    data: (gid) => G(gid) || { members: [], decks: [], guests: [], games: [] },
    pending: () => st.queue.length, pendingFor: (gid) => st.queue.filter((q) => q.groupId === gid).length,
    isPending: (id) => st.queue.some((q) => q.type === 'game' && q.game.id === id),
    lastError: () => st.lastError, lastSync: () => st.lastSync,
    isMigrated: (gid) => !!st.migrated[migrationKey(gid)], markMigrated: (gid) => { st.migrated[migrationKey(gid)] = Date.now(); emit(); },
    friendlyError, online, offline,
  };
})();
