/* Service worker : l'app fonctionne hors ligne (utile dans les rayons). */
var VERSION = "forge-v6";
var SHELL = [
  "./", "index.html", "styles.css", "data.js", "app.js", "manifest.webmanifest",
  "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(caches.match("index.html").then(function (r) { return r || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
});
