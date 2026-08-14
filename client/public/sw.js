const CACHE_NAME = "beatbox-public-lite-v3";
const SHELL = ["/", "/explore", "/producers", "/manifest.webmanifest"];
const NETWORK_ONLY_PREFIXES = ["/api/", "/auth/", "/messages", "/account", "/seller", "/studio"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && NETWORK_ONLY_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => undefined);
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("/"))));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const refresh = fetch(request).then(response => {
      if (response.ok && (url.origin === self.location.origin || request.destination === "image" || request.destination === "audio")) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())).catch(() => undefined);
      }
      return response;
    });
    return cached || refresh.catch(() => caches.match("/"));
  }));
});
