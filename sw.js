const CACHE_NAME = "vocab-8000-pwa-v1";

const CORE_PATHS = [
  "./",
  "./index.html",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./wordbooks/manifest.json",
  "./wordbooks/cet6.json",
  "./wordbooks/toefl.json",
  "./wordbooks/ielts.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_PATHS.map((path) => new URL(path, self.registration.scope))))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;

  const sameOriginUrls = event.data.urls.filter((url) => {
    try {
      return new URL(url, self.location.href).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(sameOriginUrls))
      .catch(() => undefined),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(new URL("./index.html", self.registration.scope), response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(new URL("./index.html", self.registration.scope))) ||
      (await cache.match(new URL("./", self.registration.scope))) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}
