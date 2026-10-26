/*
 * Service Worker für ShiftNexo.
 *
 * Bewusst zurückhaltend: Seiten werden NICHT zwischengespeichert. Sie sind
 * angemeldet und personenbezogen – ein Cache auf einem geteilten Diensthandy
 * würde sonst nach dem Abmelden noch fremde Daten zeigen. Gespeichert werden
 * nur unveränderliche Dateien (die Bundles unter /_next/static tragen einen
 * Hash im Namen) und die Offline-Seite.
 */

const CACHE = "schichtplan-v1";
/**
 * Der Privat-Kalender (nur diese eine Seite) darf zusätzlich offline geöffnet
 * werden: die zuletzt geladene Fassung liegt hier. Wie die Schichten auf dem
 * Gerät (geraete-speicher.ts) verfällt sie nach 14 Tagen und wird beim
 * Abmelden gelöscht (zwischenspeicher.ts schickt „leere-privat“ an diesen Worker).
 */
const PRIVAT_CACHE = "schichtplan-privat-v1";
const PRIVAT_URL = "/privat";
const PRIVAT_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000;
/** Diese Aufrufe starten die App; ohne Netz zeigen sie den Privat-Kalender, falls einer liegt. */
const PRIVAT_STARTER = new Set(["/privat", "/privat/", "/start", "/start/"]);
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PRIVAT_CACHE).map((k) => caches.delete(k))))
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
    event.respondWith(navigieren(request, url));
  }
});

/** Die gemerkte Privat-Seite, wenn sie noch jung genug ist. */
async function gemerktePrivatSeite() {
  const cache = await caches.open(PRIVAT_CACHE);
  const hit = await cache.match(PRIVAT_URL);
  if (!hit) return null;
  const gemerkt = Number(hit.headers.get("x-gemerkt-am") || 0);
  if (!gemerkt || Date.now() - gemerkt > PRIVAT_MAX_ALTER_MS) {
    await cache.delete(PRIVAT_URL);
    return null;
  }
  return hit;
}

async function navigieren(request, url) {
  try {
    const antwort = await fetch(request);
    // Nur den Privat-Kalender selbst merken: eine echte Seite (kein Umleiten, kein Fehler).
    if (
      (url.pathname === "/privat" || url.pathname === "/privat/") &&
      antwort.ok &&
      !antwort.redirected &&
      (antwort.headers.get("content-type") || "").includes("text/html")
    ) {
      const kopie = antwort.clone();
      kopie
        .blob()
        .then((blob) => {
          const kopf = new Headers(kopie.headers);
          kopf.set("x-gemerkt-am", String(Date.now()));
          return caches.open(PRIVAT_CACHE).then((cache) => cache.put(PRIVAT_URL, new Response(blob, { status: 200, headers: kopf })));
        })
        .catch(() => undefined);
    }
    return antwort;
  } catch {
    // Kein Netz: Privat-Kalender (falls dieses Gerät einen gemerkt hat), sonst die Offline-Seite.
    if (PRIVAT_STARTER.has(url.pathname)) {
      const seite = await gemerktePrivatSeite().catch(() => null);
      if (seite) return seite;
    }
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

// Beim Abmelden: gemerkte Privat-Seite löschen.
self.addEventListener("message", (event) => {
  if (event.data === "leere-privat") {
    event.waitUntil(caches.delete(PRIVAT_CACHE));
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
