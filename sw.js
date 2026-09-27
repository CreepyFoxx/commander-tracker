/* Commander Tracker service worker: offline app shell, stale-while-revalidate. */
const CACHE = 'edh-tracker-v1.3.2';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'cloud.js', 'manifest.json',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
// Login backgrounds: precached when present; a missing file never breaks the install (bump CACHE when replacing them)
const OPTIONAL = ['img/login-phone.jpg', 'img/login-tablet.jpg'];
// supabase-js, pinned (immutable URL): cached for offline use; the Supabase API itself is never cached
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js'];
const CDN_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache so a new version never precaches stale files
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
    // the CDN copy is optional: a CDN hiccup must not break installing the app shell (online features then load later)
    await Promise.all(CDN.map((u) => c.add(new Request(u, { mode: 'cors', credentials: 'omit' })).catch(() => {})));
    await Promise.all(OPTIONAL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (!old.length) return; // first install: nothing stale on screen
    // Upgrade: reload open windows once so they run the new version (game state is persisted in localStorage).
    const wins = await self.clients.matchAll({ type: 'window' });
    for (const c of wins) {
      try { if ('navigate' in c) { await c.navigate(c.url); continue; } } catch (err) { /* fall through */ }
      c.postMessage({ type: 'sw-updated' });
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === CDN_HOST) { // versioned library files: cache-first
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok && (res.type === 'cors' || res.type === 'basic')) cache.put(req.url, res.clone());
      return res;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase API, Google etc.: never touched by the SW
  const isNav = req.mode === 'navigate';
  // OAuth callback (?code= / ?error=): let the browser load it from the network untouched, so the query reaches the app as-is
  if (isNav && ['code', 'error', 'error_description'].some((k) => url.searchParams.has(k))) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = isNav
      ? (await cache.match('index.html')) || (await cache.match('./'))
      : await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(isNav ? 'index.html' : req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
