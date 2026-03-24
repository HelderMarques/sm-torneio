const CACHE = 'sm-torneio-v1';

// On install: activate immediately without waiting for old clients to close
self.addEventListener('install', () => self.skipWaiting());

// On activate: take control of all open tabs right away
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests (HTML) and assets: network-first
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Clone and cache the fresh response
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() =>
        // Network failed (offline) — return cached version
        caches.match(e.request)
      )
  );
});
