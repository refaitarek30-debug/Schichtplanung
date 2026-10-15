"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ProfilBlatt, useBenachrichtigungen } from "@/components/kalender/profil-blatt";
import { useSession } from "@/context/session";

/**
 * Runder Glas-Knopf oben rechts auf jeder Seite (Handy, nur für
 * freigeschaltete Personen – das Layout bindet ihn nur dann ein). Er ersetzt
 * die ausgeblendete Kopfleiste und öffnet das Profil-Fenster: Benachrichtigungen,
 * Profil, Einstellungen, Ansicht wechseln, Abmelden. Im Kalender gibt es den
 * Knopf bereits in dessen eigener Kopfzeile.
 */

const HANDY = "(max-width: 1023px)";

function useHandy() {
  return useSyncExternalStore(
    (rueckruf) => {
      const m = window.matchMedia(HANDY);
      m.addEventListener("change", rueckruf);
      return () => m.removeEventListener("change", rueckruf);
    },
    () => window.matchMedia(HANDY).matches,
    () => false,
  );
}

export function GlasProfil() {
  const pfad = usePathname() ?? "";
  const handy = useHandy();
  if (!handy || pfad === "/meine-schichten" || pfad.startsWith("/meine-schichten/")) return null;
  return <Knopf />;
}

function Knopf() {
  const { profile } = useSession();
  const { items, setItems } = useBenachrichtigungen();
  const [offen, setOffen] = useState(false);
  const ungelesen = (items ?? []).some((n) => !n.readAt);

  return (
    <>
      <button
        type="button"
        data-glas-profil
        onClick={() => setOffen(true)}
        aria-label={ungelesen ? "Profil, ungelesene Benachrichtigungen" : "Profil"}
        className="glas privat-schrift fixed right-3 top-[calc(max(0.5rem,env(safe-area-inset-top))+0.1rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full text-ink"
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
