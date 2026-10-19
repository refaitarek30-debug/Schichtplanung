"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Startseite: Umschalter „Privat | Betrieb“. Beide Hälften stehen im HTML
 * (Suchmaschinen, ohne JavaScript), sichtbar ist immer nur eine. Der Stand
 * kommt aus dem Anker der Adresse (#privat, #betrieb, #preise …), damit
 * Links von anderen Seiten direkt auf der richtigen Hälfte landen.
 */
export type Bereich = "privat" | "betrieb";

const NUR_BETRIEB = new Set(["betrieb", "unternehmen", "preise", "rollen"]);
const NUR_PRIVAT = new Set(["privat", "kalender"]);
/** Anker, die es in beiden Hälften gibt – sie heißen dort z. B. „faq-privat“. */
const GETEILT = new Set(["funktionen", "faq", "sicherheit"]);

let gewaehlt: Bereich | null = null;
/** Nach dem Umschalten dorthin scrollen (Element-ID). */
let ziel: string | null = null;
const hoerer = new Set<() => void>();

function bereichAusAnker(anker: string): Bereich | null {
  const a = anker.replace(/^#/, "");
  if (NUR_BETRIEB.has(a) || a.endsWith("-betrieb")) return "betrieb";
  if (NUR_PRIVAT.has(a) || a.endsWith("-privat")) return "privat";
  return null;
}

function lesen(): Bereich {
  return gewaehlt ?? bereichAusAnker(window.location.hash) ?? "privat";
}

function melden() {
  hoerer.forEach((h) => h());
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Anker auswerten: Hälfte wählen und das Ziel zum Scrollen vormerken. */
function gehe(anker: string) {
  const a = anker.replace(/^#/, "");
  const b = bereichAusAnker(a) ?? lesen();
  gewaehlt = b;
  ziel = a === "" ? null : GETEILT.has(a) ? `${a}-${b}` : a;
  melden();
}

export function useBereich(): Bereich {
  return useSyncExternalStore(abonnieren, lesen, () => "privat");
}

function scrolleZumZiel() {
  if (!ziel) return;
  const id = ziel;
  ziel = null;
  const el = document.getElementById(id);
  if (!el) return;
  // Die beiden Hälften beginnen ganz oben – dort genügt der Seitenanfang.
  if (id === "privat" || id === "betrieb") window.scrollTo({ top: 0 });
  else el.scrollIntoView({ block: "start" });
}

/** Die zwei Hälften der Startseite. */
export function BereichSeiten({ privat, betrieb }: { privat: ReactNode; betrieb: ReactNode }) {
  const bereich = useBereich();

  // Klicks auf Anker der Startseite selbst behandeln: so funktioniert auch ein
  // zweiter Klick auf denselben Anker und das Ziel in der anderen Hälfte.
  useEffect(() => {
    function klick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      const m = /^\/?#([\w-]+)$/.exec(href);
      if (!m) return;
      e.preventDefault();
      a.closest("details")?.removeAttribute("open");
      history.pushState(null, "", `#${m[1]}`);
      gehe(m[1]);
    }
    function anker() {
      gehe(window.location.hash);
    }
    document.addEventListener("click", klick);
    window.addEventListener("hashchange", anker);
    window.addEventListener("popstate", anker);
    // Beim Öffnen mit Anker (z. B. von einer anderen Seite: /#preise).
    if (window.location.hash) gehe(window.location.hash);
    return () => {
      document.removeEventListener("click", klick);
      window.removeEventListener("hashchange", anker);
      window.removeEventListener("popstate", anker);
    };
  }, []);

  // Nach dem Umschalten (und dem Zeichnen) zum Ziel scrollen.
  useEffect(() => {
    const id = requestAnimationFrame(scrolleZumZiel);
    return () => cancelAnimationFrame(id);
  });

  return (
    <>
      <div id="privat" hidden={bereich !== "privat"}>
        {privat}
      </div>
      <div id="betrieb" hidden={bereich !== "betrieb"}>
        {betrieb}
      </div>
    </>
  );
}

/** Segment-Schalter in der Kopfzeile. Auf anderen Seiten führt er zur Startseite. */
export function BereichSchalter({ className }: { className?: string }) {
  const bereich = useBereich();
  const startseite = usePathname() === "/";
  const optionen: { id: Bereich; text: string }[] = [
    { id: "privat", text: "Privat" },
    { id: "betrieb", text: "Betrieb" },
  ];
  return (
    <nav aria-label="Bereich wählen" className={cn("relative grid grid-cols-2 rounded-full bg-ink/[0.07] p-[3px]", className)}>
      <span
        aria-hidden
        className={cn(
          "absolute bottom-[3px] left-[3px] top-[3px] w-[calc(50%-3px)] rounded-full bg-surface shadow-[0_1px_3px_rgba(17,24,39,0.12),0_4px_12px_-4px_rgba(17,24,39,0.12)] transition-transform duration-300 ease-out",
          !startseite && "opacity-0",
          bereich === "betrieb" && "translate-x-full",
        )}
      />
      {optionen.map((o) => {
        const aktiv = startseite && bereich === o.id;
        return (
          <a
            key={o.id}
            href={`/#${o.id}`}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "relative z-10 rounded-full px-4 py-1.5 text-center text-[13.5px] font-semibold transition-colors sm:px-5",
              aktiv ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.text}
          </a>
        );
      })}
    </nav>
  );
}

/** Der Knopf rechts oben – passend zur gewählten Hälfte. */
export function BereichKnopf({ className }: { className?: string }) {
  const bereich = useBereich();
  const startseite = usePathname() === "/";
  const betrieb = startseite && bereich === "betrieb";
  return (
    <a
      href={betrieb ? "/demo" : "/privat/registrieren"}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full bg-brand-500 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-600",
        className,
      )}
    >
      {betrieb ? "Live-Demo" : "Kostenlos starten"}
    </a>
  );
}
