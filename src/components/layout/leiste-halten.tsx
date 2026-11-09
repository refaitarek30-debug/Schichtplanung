"use client";

import { useEffect } from "react";

/** Die feste untere Leiste: im Betrieb `data-mobile-nav`, im Privatbereich die „Bereiche“-Leiste. */
const LEISTE = "[data-mobile-nav], nav[aria-label='Bereiche']";
const EINGABE = "input, select, textarea, [contenteditable='true']";

/**
 * iPhone (Safari und App vom Startbildschirm): Nach dem Schließen der
 * Tastatur, einer Auswahlliste oder einer Systemabfrage (z. B. „Mitteilungen
 * erlauben?“) bleibt die feste untere Leiste manchmal um deren Höhe nach oben
 * verschoben – sie steht dann mitten im Bild, bis man wieder scrollt. Ein
 * Pixel hin und zurück zwingt Safari, sie neu zu setzen. Bei Zoom (zwei
 * Finger) bleibt alles, wie es ist.
 *
 * Zwei Wege:
 *  1. Nach bekannten Auslösern (Feld verlassen, Tastatur zu) sofort.
 *  2. Ein Wächter prüft einmal pro Sekunde, ob die Leiste noch unten sitzt.
 *     Er greift auch dann, wenn der Auslöser unbekannt ist.
 */
export function LeisteHalten() {
  useEffect(() => {
    const vv = window.visualViewport;
    let uhr: number | undefined;

    /** Ein Pixel hin und zurück – am Seitenende erst nach oben, sonst nach unten. */
    function anstossen() {
      const amEnde = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
      const schritt = amEnde ? -1 : 1;
      window.scrollBy(0, schritt);
      requestAnimationFrame(() => window.scrollBy(0, -schritt));
    }

    function imFeld(): boolean {
      const feld = document.activeElement;
      return !!feld && feld.matches(EINGABE);
    }

    function neuSetzen() {
      window.clearTimeout(uhr);
      uhr = window.setTimeout(() => {
        if (vv && vv.scale > 1.01) return;
        if (imFeld()) return;
        anstossen();
      }, 150);
    }

    function nachFeld(e: FocusEvent) {
      if (e.target instanceof Element && e.target.matches("input, select, textarea")) neuSetzen();
    }

    // Wird der sichtbare Bereich deutlich größer, ist die Tastatur zu.
    let hoehe = vv?.height ?? 0;
    function groesse() {
      if (!vv) return;
      if (vv.height > hoehe + 80) neuSetzen();
      hoehe = vv.height;
    }

    // --- Wächter -----------------------------------------------------------
    let zuletztGescrollt = 0;
    let beruehrt = false;
    let versuche = 0;
    let letzterVersuch = 0;

    function gescrollt() {
      zuletztGescrollt = Date.now();
    }

    /** Sitzt die Leiste deutlich über dem unteren Rand des sichtbaren Bereichs? */
    function zuHoch(): boolean {
      const leiste = document.querySelector(LEISTE);
      if (!leiste) return false;
      const r = leiste.getBoundingClientRect();
      // Am Computer ausgeblendet (display: none) – nichts zu prüfen.
      if (r.height === 0) return false;
      const unten = vv ? vv.offsetTop + vv.height : window.innerHeight;
      // Die schwebende Leiste hält höchstens etwa 35 px Abstand zum Rand.
      return r.bottom < unten - 70;
    }

    function wachen() {
      if (document.hidden || beruehrt) return;
      // Mitten im Scrollen oder gleich danach: nicht dazwischenfunken.
      if (Date.now() - zuletztGescrollt < 600) return;
      if (vv && vv.scale > 1.01) return;
      if (imFeld()) return;
      if (!zuHoch()) {
        versuche = 0;
        return;
      }
      // Hilft der Anstoß nicht, nicht endlos weitermachen.
      if (versuche >= 3 || Date.now() - letzterVersuch < 3000) return;
      versuche += 1;
      letzterVersuch = Date.now();
      anstossen();
    }

    const takt = window.setInterval(wachen, 1000);
    const anfassen = () => {
      beruehrt = true;
    };
    const loslassen = () => {
      beruehrt = false;
      versuche = 0;
    };

    document.addEventListener("focusout", nachFeld);
    vv?.addEventListener("resize", groesse);
    window.addEventListener("scroll", gescrollt, { passive: true });
    window.addEventListener("touchstart", anfassen, { passive: true });
    window.addEventListener("touchend", loslassen, { passive: true });
    window.addEventListener("touchcancel", loslassen, { passive: true });
    return () => {
      window.clearTimeout(uhr);
      window.clearInterval(takt);
      document.removeEventListener("focusout", nachFeld);
      vv?.removeEventListener("resize", groesse);
      window.removeEventListener("scroll", gescrollt);
      window.removeEventListener("touchstart", anfassen);
      window.removeEventListener("touchend", loslassen);
      window.removeEventListener("touchcancel", loslassen);
    };
  }, []);
  return null;
}
