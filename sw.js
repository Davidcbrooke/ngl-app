// NGL Club Hub offline support. Keeps a copy of the app's own files (and the Firebase and font files it loads)
// on this device, so the app, and the competition music player, still open after a reload with no internet.
// Online, the app's own files always come fresh from the network first; the copy is only used when that fails.
// Data: Firestore keeps its own offline copy (js/firebase.js); floor music is saved in the player's own store.
const CACHE = 'ngl-app-v1';
const SHARED = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|cdnjs\.cloudflare\.com\/)/;
const mine = url => url.startsWith(self.registration.scope);
const keep = url => mine(url) || SHARED.test(url);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// The page sends the files it has loaded (including admin apps opened on demand): keep a copy of each
self.addEventListener('message', e => {
  const urls = (e.data && e.data.cache) || []; if (!urls.length) return;
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.filter(keep).map(async u => {
    try { if (await c.match(u) && SHARED.test(u)) return; const r = await fetch(u, {cache: 'no-cache'}); if (r.ok || r.type === 'opaque') await c.put(u, r); } catch (_) {}
  }))));
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = req.url.split('#')[0];
  if (SHARED.test(url)) {                         // versioned library and font files: the saved copy first
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(url)) || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(url, r.clone()); return r; })));
    return;
  }
  if (!mine(url)) return;                         // database, storage and everything else: straight to the network
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(req);
      if (r.ok) c.put(url, r.clone());
      return r;
    } catch (err) {
      const hit = (await c.match(url)) || (req.mode === 'navigate' && ((await c.match(self.registration.scope)) || (await c.match(url, {ignoreSearch: true}))));
      if (hit) return hit;
      throw err;
    }
  })());
});
