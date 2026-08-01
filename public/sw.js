// The service worker deliberately does NOT touch navigations or HTML.
//
// A network-first navigation handler still falls back to a cached shell the
// moment a cold start races the network — which on iOS is the only moment a
// new version can land, so the app appeared stuck until it was force-quit.
// Now HTML always comes from the network, and the cache only holds hashed
// static assets and images, which can never be stale by definition.

const ASSETS = "heard-assets-v3";
const IMAGES = "heard-img-v3";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== ASSETS && k !== IMAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") return;              // never intercept pages
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/version.json" || url.pathname === "/sw.js") return;

  const hashed = url.pathname.startsWith("/_next/static/");
  const isImage = req.destination === "image";
  if (!hashed && !isImage) return;                  // everything else: network

  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(isImage ? IMAGES : ASSETS).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
