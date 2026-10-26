"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gruppe, WahlZeile } from "./gruppe";
import { createClient } from "@/lib/supabase/client";
import { START_COOKIE, START_COOKIE_MAX_AGE, STARTSEITEN, startCookieWert, type StartSeite } from "@/lib/start-seite";
import { useSession } from "@/context/session";
import { SchichtleitungHinweis } from "@/components/ui/schichtleitung-hinweis";

/** Jede Person wählt, was beim Öffnen der App zuerst kommt. */
export function StartSeiteCard() {
  const { profile } = useSession();
  const router = useRouter();
  const [wahl, setWahl] = useState<StartSeite>(profile.startSeite ?? "dashboard");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, start] = useTransition();

  function waehlen(neu: StartSeite) {
    if (neu === wahl) return;
    const vorher = wahl;
    setWahl(neu);
    setFehler(null);
    setGespeichert(false);
    start(async () => {
      const { error } = await createClient()
        .from("profiles")
        .update({ start_seite: neu === "dashboard" ? null : neu })
        .eq("id", profile.id);
      if (error) {
        setWahl(vorher);
        setFehler("Die Auswahl konnte nicht gespeichert werden.");
        return;
      }
      // Merkzettel für den nächsten Start gleich anpassen (siehe middleware.ts).
      document.cookie = `${START_COOKIE}=${encodeURIComponent(startCookieWert(profile.id, neu))}; path=/; max-age=${START_COOKIE_MAX_AGE}; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
      setGespeichert(true);
      router.refresh();
    });
  }

  return (
    <Gruppe
      titel="Startseite"
      hinweis={
        fehler ? (
          <span className="text-crit-fg">
            {fehler}
            <SchichtleitungHinweis text={fehler} />
          </span>
        ) : gespeichert ? (
          <span className="text-ok-fg">Gespeichert – gilt ab dem nächsten Öffnen.</span>
        ) : (
          "Was beim Öffnen der App zuerst kommt. Gilt für dich auf allen Geräten."
        )
      }
    >
      <div role="radiogroup" aria-label="Startseite" className="divide-y divide-line">
        {STARTSEITEN.map((s) => (
          <WahlZeile key={s.wert} aktiv={wahl === s.wert} titel={s.label} text={s.text} disabled={laeuft} onClick={() => waehlen(s.wert)} />
        ))}
      </div>
    </Gruppe>
  );
}
