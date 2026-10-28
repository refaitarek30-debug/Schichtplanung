"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ProfilBlatt, useBenachrichtigungen } from "@/components/kalender/profil-blatt";
import { NeuigkeitenKnopf } from "@/components/layout/neuigkeiten";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";

/**
 * Runder Glas-Knopf für das Profil-Fenster (Benachrichtigungen, Profil,
 * Einstellungen, Ansicht wechseln, Abmelden). Nur auf dem Handy und nur für
 * freigeschaltete Personen – das Layout setzt dafür die Markierung
 * `data-glas-leiste`. Im Kalender gibt es den Knopf in dessen eigener Kopfzeile.
 *
 * Wo der Knopf steht:
 *  - `ProfilInline` sitzt in der Titelzeile einer Seite (PageHeader, Dashboard)
 *    rechts neben dem Titel.
 *  - `GlasProfil` (im Layout) ist der Ersatz für Seiten ohne eigene Titelzeile:
 *    fest oben rechts, mit freier Zeile darunter (data-glas-profil-fix).
 */

const HANDY = "(max-width: 1023px)";

export function useGlasModus() {
  return useSyncExternalStore(
    (rueckruf) => {
      const m = window.matchMedia(HANDY);
      m.addEventListener("change", rueckruf);
      return () => m.removeEventListener("change", rueckruf);
    },
    () => window.matchMedia(HANDY).matches && !!document.querySelector("[data-glas-leiste]"),
    () => false,
  );
}

function imKalender(pfad: string) {
  return pfad === "/meine-schichten" || pfad.startsWith("/meine-schichten/");
}

// Wie viele Titelzeilen auf der Seite einen eigenen Knopf zeigen – nur wenn
// keine da ist, springt der feste Knopf ein.
let inlineAnzahl = 0;
const hoerer = new Set<() => void>();
function melden() {
  for (const h of hoerer) h();
}
function anmelden() {
  inlineAnzahl += 1;
  melden();
  return () => {
    inlineAnzahl -= 1;
    melden();
  };
}
function useInlineAnzahl() {
  return useSyncExternalStore(
    (rueckruf) => {
      hoerer.add(rueckruf);
      return () => hoerer.delete(rueckruf);
    },
    () => inlineAnzahl,
    () => 0,
  );
}

/** In der Titelzeile einer Seite: rechts neben dem Titel (Elternelement `relative`). */
export function ProfilInline() {
  const pfad = usePathname() ?? "";
  const aktiv = useGlasModus() && !imKalender(pfad);
  useEffect(() => (aktiv ? anmelden() : undefined), [aktiv]);
  if (!aktiv) return null;
  return <Knopf inline />;
}

/** Ersatz: fest oben rechts, wenn die Seite keine eigene Titelzeile mit Knopf hat. */
export function GlasProfil() {
  const pfad = usePathname() ?? "";
  const aktiv = useGlasModus() && !imKalender(pfad);
  const inline = useInlineAnzahl();
  if (!aktiv || inline > 0) return null;
  return <Knopf />;
}

function Knopf({ inline = false }: { inline?: boolean }) {
  const { profile } = useSession();
  const { items, setItems } = useBenachrichtigungen();
  const [offen, setOffen] = useState(false);
  const ungelesen = (items ?? []).some((n) => !n.readAt);

  return (
    <>
      {/* Glühbirne links neben dem Profil – gleiche Höhe, gleicher Stil. */}
      <NeuigkeitenKnopf
        rund
        className={cn(
          "z-20 text-ink",
          inline
            ? "absolute right-[3.1rem] top-[-3px]"
            : "fixed right-[3.6rem] top-[calc(max(0.5rem,env(safe-area-inset-top))+0.1rem)]",
        )}
      />
      <button
        type="button"
        data-glas-profil
        data-glas-profil-fix={inline ? undefined : ""}
        onClick={() => setOffen(true)}
        aria-label={ungelesen ? "Profil, ungelesene Benachrichtigungen" : "Profil"}
        className={cn(
          "glas privat-schrift z-20 flex h-10 w-10 items-center justify-center rounded-full text-ink",
          inline
            ? "absolute right-0 top-[-3px]"
            : "fixed right-3 top-[calc(max(0.5rem,env(safe-area-inset-top))+0.1rem)]",
        )}
      >
        <Avatar employee={profile} className="h-8 w-8 bg-ink/[0.07] text-[12px] text-ink" />
        {ungelesen ? (
          <span aria-hidden className="absolute right-0 top-0 h-3 w-3 rounded-full bg-crit-dot ring-2 ring-white/80" />
        ) : null}
      </button>
      {offen ? <ProfilBlatt items={items} setItems={setItems} onClose={() => setOffen(false)} /> : null}
    </>
  );
}

/**
 * Passt die Seitenüberschrift an die Breite an: Passt der Titel (z. B. „Guten
 * Tag, Oguzhan 👋“) bei voller Größe nicht in eine Zeile neben den Knopf,
 * wird die Schrift schrittweise kleiner (bis 20 px), erst danach bricht er um.
 * Gilt für jede Person und jeden Namen.
 */
export function GlasTitelAnpassung() {
  const pfad = usePathname() ?? "";
  const aktiv = useGlasModus() && !imKalender(pfad);

  useEffect(() => {
    if (!aktiv) return;
    const main = document.querySelector("main");
    if (!main) return;
    let raf = 0;

    const anpassen = () => {
      const h1 = main.querySelector<HTMLElement>(":scope > :not([data-glas-seite]) header h1");
      const kopf = h1?.closest("header");
      if (!h1 || !kopf) return;
      // Gemessen wird an der Breite der Kopfzeile: Der Titel dehnt sich in
      // manchen Zeilen nach seinem Inhalt aus und wäre sonst nie „zu breit“.
      const platz = kopf.clientWidth;
      h1.style.fontSize = "";
      h1.style.whiteSpace = "nowrap";
      let px = Math.round(parseFloat(getComputedStyle(h1).fontSize)) || 30;
      while (h1.scrollWidth > platz && px > 20) {
        px -= 1;
        h1.style.fontSize = `${px}px`;
      }
      // Danach darf er normal umbrechen (nötig nur, wenn selbst 20 px nicht reichen).
      h1.style.whiteSpace = "";
    };
    const geplant = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(anpassen);
    };

    geplant();
    const beobachter = new MutationObserver(geplant);
    beobachter.observe(main, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", geplant);
    return () => {
      cancelAnimationFrame(raf);
      beobachter.disconnect();
      window.removeEventListener("resize", geplant);
    };
  }, [aktiv, pfad]);

  return null;
}
