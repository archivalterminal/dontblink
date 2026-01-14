// NO-CACHE service worker (for Android sanity)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Always go to network (no caching)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
