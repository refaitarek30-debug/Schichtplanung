"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, HandHelping } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fassenZusammen, fetchReport } from "@/lib/data/report";
import { fetchCompanyRules } from "@/lib/data/staffing-rules";

/**
 * Zwei Kennzahlen für die Führung, direkt auf dem Dashboard.
 *
 * Bewusst nur zwei: das Dashboard soll den Tag zeigen, nicht die
 * Jahresauswertung ersetzen. Die Gesundheitsrate des laufenden Monats
 * beantwortet „wie stehen wir gerade da", die offenen Ersatzanfragen
 * „wartet jemand auf mich".
 *
 * Die Rate kostet rund eine Viertelsekunde, weil sie über dieselbe
 * Funktion läuft wie die Auswertung – und deshalb nicht von ihr abweichen
 * kann. Sie wird nachgeladen; die übrigen Kacheln stehen sofort.
 */
export function LeadershipKpis({
  zeigeRate = true,
  zeigeAnfragen = true,
}: {
  zeigeRate?: boolean;
  zeigeAnfragen?: boolean;
} = {}) {
  const { mode, role } = useSession();
  const [rate, setRate] = useState<number | null | undefined>(undefined);
  const [ziel, setZiel] = useState(96);
  const [offen, setOffen] = useState<number | null>(null);

  const laden = useCallback(async () => {
    if (mode !== "live" || role === "employee" || !isSupabaseConfigured) return;
    // Was ausgeblendet ist, wird auch nicht geladen – die Rate kostet
    // eine Viertelsekunde, die niemand zahlen soll, der sie wegklickt.
    if (!zeigeRate && !zeigeAnfragen) return;
    const jetzt = new Date();

    if (zeigeRate) try {
      const [zeilen, regeln] = await Promise.all([
        fetchReport(jetzt.getFullYear(), jetzt.getMonth() + 1),
        fetchCompanyRules(),
      ]);
      const gesamt = fassenZusammen(zeilen, () => ({ schluessel: "alle", bezeichnung: "" }))[0];
      setRate(gesamt?.gesundheitsrate ?? null);
      setZiel(regeln.gesundheitsrateZiel);
    } catch {
      // Eine Kennzahl, die nicht lädt, darf das Dashboard nicht blockieren.
      setRate(null);
    }

    if (zeigeAnfragen) try {
      const supabase = createClient();
      const { count } = await supabase
        .from("replacement_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "offen");
      setOffen(count ?? 0);
    } catch {
      setOffen(null);
    }
  }, [mode, role, zeigeRate, zeigeAnfragen]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (mode !== "live" || role === "employee") return null;

  const abweichung = typeof rate === "number" ? rate - ziel : null;

  return (
    <>
      {zeigeRate ? (
      <KpiCard
        label="Gesundheitsrate"
        value={rate === undefined ? "…" : typeof rate === "number" ? rate.toFixed(1) : "–"}
        unit="%"
        hint={
          abweichung === null
            ? `laufender Monat · Ziel ${ziel} %`
            : `${abweichung >= 0 ? "+" : ""}${abweichung.toFixed(1)} zum Ziel`
        }
        accent={
          abweichung === null
            ? "neutral"
            : abweichung >= 0
              ? "ok"
              : abweichung >= -1
                ? "warn"
                : "critical"
        }
        icon={<Activity className="h-4 w-4" strokeWidth={1.8} />}
      />
      ) : null}
      {zeigeAnfragen ? (
      <KpiCard
        label="Offene Ersatzanfragen"
        value={offen ?? "–"}
        unit={offen === 1 ? "Anfrage" : "Anfragen"}
        hint={offen === 0 ? "nichts offen" : "warten auf Antwort"}
        accent={(offen ?? 0) > 0 ? "warn" : "ok"}
        icon={<HandHelping className="h-4 w-4" strokeWidth={1.8} />}
      />
      ) : null}
    </>
  );
}
