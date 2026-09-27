/* Commander Tracker service worker: offline app shell, stale-while-revalidate. */
const CACHE = 'edh-tracker-v1.1.1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.json',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache so a new version never precaches stale files
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate';
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
