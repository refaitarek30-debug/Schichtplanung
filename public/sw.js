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

// ---- Erinnerungen (Termine, To-dos) ----------------------------------------
self.addEventListener("push", (event) => {
  let daten = {};
  try {
    daten = event.data ? event.data.json() : {};
  } catch {
    daten = { titel: "Erinnerung", text: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(daten.titel || "Erinnerung", {
      body: daten.text || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: daten.tag,
      data: { url: daten.url || "/start" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = new URL((event.notification.data && event.notification.data.url) || "/start", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        if (f.url.startsWith(self.location.origin) && "focus" in f) {
          f.navigate(ziel).catch(() => undefined);
          return f.focus();
        }
      }
      return self.clients.openWindow(ziel);
    }),
  );
});
