self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// An empty fetch handler (without respondWith) is enough to satisfy
// Chrome's PWA installability checks, while every request still goes
// straight to the network as normal — no caching, so redeploys never
// serve anyone a stale version of the app.
self.addEventListener("fetch", () => {});
