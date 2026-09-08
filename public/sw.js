// Minimal service worker — exists only to satisfy PWA installability criteria.
// It caches same-origin static assets (icons, images) so the app shell has
// something to draw from offline. Pages and API calls are never intercepted,
// so commission/order data is always fetched fresh from the network.
const CACHE_NAME = 'likenew-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset = /\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !isStaticAsset) {
    return; // let the browser/network handle everything else (pages, API calls)
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
