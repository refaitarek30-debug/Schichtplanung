/*
 * Service Worker für den Schichtplan.
 *
 * Bewusst zurückhaltend: Seiten werden NICHT zwischengespeichert. Sie sind
 * angemeldet und personenbezogen – ein Cache auf einem geteilten Diensthandy
 * würde sonst nach dem Abmelden noch fremde Daten zeigen. Gespeichert werden
 * nur unveränderliche Dateien (die Bundles unter /_next/static tragen einen
 * Hash im Namen) und die Offline-Seite.
 */

const CACHE = "schichtplan-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Anmeldung und Rückleitungen niemals anfassen.
  if (url.pathname.startsWith("/auth")) return;

  // Unveränderliche Dateien: erst Cache, dann Netz.
  const immutable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2");

  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Seitenaufrufe: immer aus dem Netz. Nur wenn das scheitert, die
  // Offline-Seite – kein Zwischenspeichern echter Inhalte.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((hit) => hit || Response.error())),
    );
  }
});
