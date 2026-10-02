const CACHE_NAME = "smart-reminder-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset))),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("smart-reminder-") && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) ??
            (await caches.match("/")) ??
            new Response("Offline", {
              status: 503,
              headers: { "content-type": "text/plain" },
            }),
        ),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached ?? fresh;
      }),
    );
  }
});
