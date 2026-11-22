"use client";

import { useCallback, useEffect, useState } from "react";
import { HandHelping } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { KachelHuelle } from "@/components/dashboard/kachel-bearbeiten";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Kennzahl für die Führung auf der Startseite: offene Ersatzanfragen –
 * „wartet jemand auf mich“. Die Gesundheitsrate und die Auswertung gibt es
 * nicht mehr (bewusst entfernt, Datenschutz).
 */
export function LeadershipKpis({
  zeigeAnfragen = true,
  kompakt = false,
}: {
  zeigeAnfragen?: boolean;
  /** Kleine Kacheln (Startseite „Kompakt“). */
  kompakt?: boolean;
} = {}) {
  const { mode, role } = useSession();
  const [offen, setOffen] = useState<number | null>(null);

  const laden = useCallback(async () => {
    if (mode !== "live" || role === "employee" || !isSupabaseConfigured) return;
    if (!zeigeAnfragen) return;
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from("replacement_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "offen");
      setOffen(count ?? 0);
    } catch {
      setOffen(null);
    }
  }, [mode, role, zeigeAnfragen]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (mode !== "live" || role === "employee") return null;

  return (
    <>
      {zeigeAnfragen ? (
      <KachelHuelle id="ersatz" name="Offene Ersatzanfragen">
      <KpiCard
        label="Offene Ersatzanfragen"
        kompakt={kompakt}
        kurz="Ersatz"
        kurzEinheit="offen"
        value={offen ?? "–"}
        unit={offen === 1 ? "Anfrage" : "Anfragen"}
        hint={offen === 0 ? "nichts offen" : "warten auf Antwort"}
        accent={(offen ?? 0) > 0 ? "warn" : "ok"}
        icon={<HandHelping className="h-4 w-4" strokeWidth={1.8} />}
      />
      </KachelHuelle>
      ) : null}
    </>
  );
}
