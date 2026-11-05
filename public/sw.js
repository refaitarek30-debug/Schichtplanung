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
 * Der eigene Kalender darf zusätzlich offline geöffnet werden – nur er, nichts
 * sonst: der Privat-Kalender (/privat) bzw. „Mein Kalender“ im Betrieb
 * (/meine-schichten). Gemerkt wird die zuletzt geladene Fassung dieser einen
 * Seite. Wie die eigenen Schichten auf dem Gerät (geraete-speicher.ts) verfällt
 * sie nach 14 Tagen und wird beim Abmelden gelöscht (zwischenspeicher.ts
 * schickt „leere-kalender“ an diesen Worker).
 */
const KALENDER_CACHE = "schichtplan-kalender-v1";
const KALENDER_SEITEN = ["/privat", "/meine-schichten"];
const KALENDER_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Schnell öffnen: Ist der eigene Kalender auf dem Gerät gemerkt, erscheint er
 * sofort (auch mit Netz) und wird im Hintergrund aufgefrischt – die Daten darin
 * laden danach ebenfalls nach. Dazu merkt sich der Worker, ob die Startadresse
 * (/start, das Symbol auf dem Home-Bildschirm) bei dieser Person im Kalender
 * landet. Verliert die Person die Sitzung, merkt der Worker das bei der
 * Auffrischung (Weiterleitung zur Anmeldung): Dann ist alles Gemerkte weg und
 * das offene Fenster geht zur Anmeldung. Ob etwas aus dem Gerätespeicher kam,
 * steht im Antwortkopf „Server-Timing: sn-kalender“.
 */
const START_PFAD = "/start";
const START_MARKE = "/__start-ziel";
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== KALENDER_CACHE).map((k) => caches.delete(k))))
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
    event.respondWith(navigieren(event, request, url));
  }
});

const ohneSchraegstrich = (pfad) => (pfad.length > 1 && pfad.endsWith("/") ? pfad.slice(0, -1) : pfad);

/** Eine gemerkte Kalender-Seite, wenn sie noch jung genug ist. */
async function gemerkteKalenderSeite(pfad) {
  const cache = await caches.open(KALENDER_CACHE);
  const hit = await cache.match(pfad);
  if (!hit) return null;
  const gemerkt = Number(hit.headers.get("x-gemerkt-am") || 0);
  if (!gemerkt || Date.now() - gemerkt > KALENDER_MAX_ALTER_MS) {
    await cache.delete(pfad);
    return null;
  }
  return hit;
}

/** Die gemerkte Seite ausliefern – mit Hinweis im Antwortkopf, dass sie vom Gerät kommt. */
function ausDemGeraet(hit) {
  const kopf = new Headers(hit.headers);
  kopf.set("Server-Timing", 'sn-kalender;desc="aus dem Gerätespeicher"');
  return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers: kopf });
}

const istHtml = (antwort) => (antwort.headers.get("content-type") || "").includes("text/html");

/** Genau diese eine Kalender-Seite merken (eine andere gemerkte geht weg). */
async function merkeKalenderSeite(pfad, antwort) {
  const kopie = antwort.clone();
  const blob = await kopie.blob();
  const kopf = new Headers(kopie.headers);
  kopf.set("x-gemerkt-am", String(Date.now()));
  const cache = await caches.open(KALENDER_CACHE);
  for (const anderer of KALENDER_SEITEN) if (anderer !== pfad) await cache.delete(anderer);
  await cache.put(pfad, new Response(blob, { status: 200, headers: kopf }));
}

/**
 * Wohin führt die Startadresse bei dieser Person? Gemerkt wird der Kalender –
 * oder „kein Kalender“ (KEIN_KALENDER), damit der Worker nicht bei jedem Öffnen
 * die Startseite ein zweites Mal im Hintergrund lädt. `vergessen` löscht die
 * Marke ganz (Startseite geändert, Betrieb/Privat gewechselt).
 */
const KEIN_KALENDER = "-";
/** Nach so langer Zeit wird die Startadresse einmal neu nachverfolgt. */
const START_NEU_PRUEFEN_MS = 24 * 60 * 60 * 1000;

async function merkeStartZiel(pfad) {
  const cache = await caches.open(KALENDER_CACHE);
  await cache.put(
    START_MARKE,
    new Response(pfad || KEIN_KALENDER, {
      status: 200,
      headers: { "Content-Type": "text/plain", "x-gemerkt-am": String(Date.now()) },
    }),
  );
}

async function vergissStartZiel() {
  const cache = await caches.open(KALENDER_CACHE);
  await cache.delete(START_MARKE);
}

/**
 * { ziel, neuPruefen }: ziel = gemerkter Kalender oder null; neuPruefen = die
 * Marke fehlt oder ist älter als einen Tag (dann einmal im Hintergrund nachsehen).
 */
async function gemerktesStartZiel() {
  const cache = await caches.open(KALENDER_CACHE);
  const hit = await cache.match(START_MARKE);
  if (!hit) return { ziel: null, neuPruefen: true };
  const gemerkt = Number(hit.headers.get("x-gemerkt-am") || 0);
  const alter = Date.now() - gemerkt;
  if (!gemerkt || alter > KALENDER_MAX_ALTER_MS) {
    await cache.delete(START_MARKE);
    return { ziel: null, neuPruefen: true };
  }
  const pfad = await hit.text();
  return { ziel: KALENDER_SEITEN.includes(pfad) ? pfad : null, neuPruefen: alter > START_NEU_PRUEFEN_MS };
}

/** Eine Seite mit Weiterleitungen frisch vom Server holen (Hintergrund). */
const holeSeite = (pfad) =>
  fetch(pfad, { redirect: "follow", credentials: "same-origin", headers: { Accept: "text/html" } });

/**
 * Keine Sitzung mehr (die Auffrischung landete bei der Anmeldung): alles
 * Gemerkte vom Gerät löschen und das offene Kalender-Fenster zur Anmeldung
 * schicken – nichts Persönliches soll ohne Anmeldung stehen bleiben.
 */
async function sitzungVerloren(zielUrl) {
  await caches.delete(KALENDER_CACHE);
  const fenster = await self.clients.matchAll({ type: "window" });
  for (const f of fenster) {
    const pfad = ohneSchraegstrich(new URL(f.url).pathname);
    if (KALENDER_SEITEN.includes(pfad)) f.navigate(zielUrl).catch(() => undefined);
  }
}

/** Gemerkte Kalender-Seite im Hintergrund auffrischen. Ohne Netz: nichts tun. */
async function auffrischen(pfad) {
  let antwort;
  try {
    antwort = await holeSeite(pfad);
  } catch {
    return;
  }
  const ende = ohneSchraegstrich(new URL(antwort.url).pathname);
  if (ende.startsWith("/login")) return sitzungVerloren(antwort.url);
  if (!antwort.ok || ende !== pfad || !istHtml(antwort)) return;
  await merkeKalenderSeite(pfad, antwort);
}

/** Startadresse im Hintergrund nachverfolgen: führt sie in den Kalender, wird beides gemerkt. */
async function auffrischenStart() {
  let antwort;
  try {
    antwort = await holeSeite(START_PFAD);
  } catch {
    return;
  }
  const ende = ohneSchraegstrich(new URL(antwort.url).pathname);
  if (ende.startsWith("/login")) return sitzungVerloren(antwort.url);
  if (!antwort.ok) return;
  if (KALENDER_SEITEN.includes(ende) && istHtml(antwort)) {
    await merkeKalenderSeite(ende, antwort);
    await merkeStartZiel(ende);
  } else {
    await merkeStartZiel(null);
  }
}

async function navigieren(event, request, url) {
  const pfad = ohneSchraegstrich(url.pathname);
  const ohneAnhang = url.search === "";

  // Der eigene Kalender: gemerkte Seite sofort, nebenher frisch holen.
  if (ohneAnhang && KALENDER_SEITEN.includes(pfad)) {
    const seite = await gemerkteKalenderSeite(pfad).catch(() => null);
    if (seite) {
      event.waitUntil(auffrischen(pfad));
      return ausDemGeraet(seite);
    }
  }

  // Startadresse: landet diese Person im Kalender, gleich dorthin (die Seite selbst kommt dann vom Gerät
  // und frischt sich dort selbst auf). Im Hintergrund nachgesehen wird nur, wenn noch nichts gemerkt
  // ist oder die Marke älter als einen Tag ist – sonst würde jede Öffnung den Server doppelt belasten.
  if (ohneAnhang && pfad === START_PFAD) {
    const { ziel, neuPruefen } = await gemerktesStartZiel().catch(() => ({ ziel: null, neuPruefen: false }));
    if (neuPruefen) event.waitUntil(auffrischenStart());
    if (ziel && (await gemerkteKalenderSeite(ziel).catch(() => null))) {
      return Response.redirect(new URL(ziel, self.location.origin).href, 302);
    }
  }

  try {
    const antwort = await fetch(request);
    // Nur den eigenen Kalender merken: eine echte Seite (kein Umleiten, kein Fehler).
    if (KALENDER_SEITEN.includes(pfad) && antwort.ok && !antwort.redirected && istHtml(antwort)) {
      event.waitUntil(merkeKalenderSeite(pfad, antwort).catch(() => undefined));
    }
    return antwort;
  } catch {
    // Kein Netz: jede Seite springt zum eigenen Kalender, falls dieses Gerät einen gemerkt hat.
    for (const kandidat of KALENDER_SEITEN) {
      const seite = await gemerkteKalenderSeite(kandidat).catch(() => null);
      if (!seite) continue;
      // Genau die Kalender-Seite: gleich ausliefern. Jede andere Adresse: dorthin umleiten,
      // damit Adresse und Inhalt zusammenpassen.
      if (kandidat === pfad) return ausDemGeraet(seite);
      return new Response(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kalender</title><script>location.replace(${JSON.stringify(kandidat)})</script>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

// Beim Abmelden: gemerkte Kalender-Seite löschen.
self.addEventListener("message", (event) => {
  if (event.data === "leere-kalender") {
    event.waitUntil(caches.delete(KALENDER_CACHE));
  }
  // Die Startseite wurde geändert (oder Betrieb/Privat gewechselt): das gemerkte Ziel gilt nicht mehr.
  if (event.data === "vergiss-start") {
    event.waitUntil(vergissStartZiel());
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
