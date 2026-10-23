"use client";

import { useEffect } from "react";

/**
 * iPhone (Safari und App vom Startbildschirm): Nach dem Schließen der
 * Tastatur oder einer Auswahlliste bleibt die feste untere Leiste manchmal
 * um deren Höhe nach oben verschoben – sie steht dann mitten im Bild, bis
 * man wieder scrollt. Ein Pixel hin und zurück zwingt Safari, sie neu zu
 * setzen. Bei Zoom (zwei Finger) bleibt alles, wie es ist.
 */
export function LeisteHalten() {
  useEffect(() => {
    const vv = window.visualViewport;
    let uhr: number | undefined;

    function neuSetzen() {
      window.clearTimeout(uhr);
      uhr = window.setTimeout(() => {
        if (vv && vv.scale > 1.01) return;
        const feld = document.activeElement;
        if (feld && feld.matches("input, select, textarea, [contenteditable='true']")) return;
        window.scrollBy(0, 1);
        requestAnimationFrame(() => window.scrollBy(0, -1));
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

    document.addEventListener("focusout", nachFeld);
    vv?.addEventListener("resize", groesse);
    return () => {
      window.clearTimeout(uhr);
      document.removeEventListener("focusout", nachFeld);
      vv?.removeEventListener("resize", groesse);
    };
  }, []);
  return null;
}
