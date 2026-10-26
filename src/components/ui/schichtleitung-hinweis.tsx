"use client";

import { useSessionOptional } from "@/context/session";
import { istAllgemeinerFehler } from "@/lib/errors";

/**
 * Zusatz unter allgemeinen Fehlermeldungen im Betrieb: an wen man sich
 * wenden kann. Mitarbeitende an die Schichtleitung, die Schichtleitung an
 * die Administration. Außerhalb des Betriebs (Privatbereich, ohne Sitzung)
 * und für die Administration selbst steht nichts.
 */
export function SchichtleitungHinweis({ text, immer = false }: { text?: string; immer?: boolean }) {
  const session = useSessionOptional();
  if (!session) return null;
  if (!immer && !(text && istAllgemeinerFehler(text))) return null;
  const an =
    session.role === "employee"
      ? "deine Schichtleitung"
      : session.role === "shift_leader"
        ? "die Administration deines Betriebs"
        : null;
  if (!an) return null;
  return <span className="mt-1 block opacity-90">Wenn das Problem bleibt, wende dich bitte an {an}.</span>;
}
