"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KachelListe, startKachelOptionen } from "@/components/dashboard/tile-settings";
import { useSession } from "@/context/session";
import { useBegriffe, useZeitausgleich } from "@/lib/begriffe";
import { Gruppe } from "./gruppe";

/**
 * Kacheln auf der Startseite – dieselbe Auswahl wie beim langen Drücken auf
 * eine Kachel, hier als Liste zum An- und Abhaken.
 */
export function StartKachelnGruppe() {
  const { role, profile } = useSession();
  const t = useBegriffe();
  const za = useZeitausgleich();
  const router = useRouter();
  const [versteckt, setVersteckt] = useState(() => new Set(profile.hiddenDashboardTiles ?? []));
  const optionen = startKachelOptionen({ rolle: role, vTage: za ? t("V-Tage gesamt") : null, mitNaechster: !!profile.employeeId });
  return (
    <Gruppe titel="Kacheln auf der Startseite" hinweis="Tipp: Auf der Startseite lange auf eine Kachel drücken – dann lässt sie sich direkt ausblenden oder hinzufügen.">
      <div className="px-2 py-2 sm:px-3" data-einstellungen-kacheln>
        <KachelListe
          profileId={profile.id}
          optionen={optionen}
          versteckt={versteckt}
          onChange={(n) => {
            setVersteckt(n);
            router.refresh();
          }}
        />
      </div>
    </Gruppe>
  );
}
