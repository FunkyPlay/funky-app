// Кэш приложения: оболочка — сразу из кэша, данные — сначала сеть.
const V = "fa-v3";
const SHELL = ["./", "index.html", "style.css", "app.js", "strings.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/mark.png", "icons/wordmark.png", "fonts/roboto-condensed-700-cyrillic.woff2", "fonts/roboto-condensed-700-latin.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const own = u.origin === location.origin;
  const img = u.hostname === "raw.githubusercontent.com" && /\.(jpg|png|webp)$/i.test(u.pathname);
  if (img) { // картинки: из кэша, если есть
    e.respondWith(caches.open(V).then(c => c.match(e.request).then(r => r || fetch(e.request).then(n => { c.put(e.request, n.clone()); return n; }))));
  } else if (own) { // свои файлы: сеть, при ошибке кэш
    e.respondWith(fetch(e.request).then(n => { const k = n.clone(); caches.open(V).then(c => c.put(e.request, k)); return n; }).catch(() => caches.match(e.request)));
  }
});
