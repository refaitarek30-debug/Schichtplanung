"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { useSession } from "@/context/session";

/**
 * Hinweis auf die noch offene Ersteinrichtung.
 *
 * Bewusst ein Hinweis und keine Zwangsumleitung: wer sich anmeldet, um
 * schnell etwas nachzusehen, soll nicht in einem Assistenten landen, aus
 * dem er sich erst herausklicken muss. Direkt nach der Registrierung geht
 * es ohnehin geradewegs nach `/einrichtung` – dieser Streifen fängt den
 * Fall ab, dass jemand dort abgebrochen hat oder erst die
 * Bestätigungsmail abwarten musste.
 *
 * `setupCompletedAt` kommt aus derselben Abfrage wie Profil und
 * Unternehmen, kostet also keine zusätzliche Runde zur Datenbank.
 */
export function SetupBanner() {
  const { mode, role, company } = useSession();

  if (mode !== "live" || role !== "admin") return null;
  if (company.setupCompletedAt) return null;

  return (
    <Link
      href="/einrichtung"
      className="mb-4 flex items-start gap-3 rounded-card border border-brand-500/40 bg-brand-50 px-4 py-3 transition-colors hover:bg-brand-50/70"
    >
      <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-brand-700">
          Die Einrichtung ist noch nicht abgeschlossen
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
          Feiertage, Schichtmuster und Mitarbeiter in drei Schritten festlegen – ohne
          Feiertage rechnet die Urlaubsberechnung falsch.
        </span>
      </span>
    </Link>
  );
}
