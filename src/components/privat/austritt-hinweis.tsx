"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Einmal nach dem Austritt (Zugang zum Betrieb beendet, Privatbereich ohne
 * Frage eingerichtet): Was passiert ist, was mitgekommen ist, wo die
 * Datenschutzerklärung steht und wie man den Privatbereich wieder löscht.
 * Erscheint nur mit ?ausgetreten=1 (Weiterleitung aus privatWeitermachen).
 */
export function AustrittHinweis() {
  const params = useSearchParams();
  const router = useRouter();
  const pfad = usePathname();
  if (params.get("ausgetreten") !== "1") return null;

  return (
    <div
      role="dialog"
      aria-label="Zugang zum Betrieb beendet"
      data-austritt-hinweis
      className="glas-dicht fixed inset-x-3 bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)] z-40 mx-auto max-w-md rounded-[24px] p-5"
    >
      <p className="text-[18px] font-bold leading-tight">Dein Zugang zum Betrieb ist beendet</p>
      <p className="mt-1.5 text-[14.5px] leading-snug text-ink-muted">
        Du nutzt ShiftNexo jetzt privat – kostenlos. Mitgekommen sind deine Termine, To-dos, eigenen Einträge und
        Farben. Schichten, Krank- und Urlaubsanträge bleiben beim Betrieb. Dein früherer Betrieb sieht von deinem
        Privatbereich nichts.
      </p>
      <p className="mt-2 text-[13px] text-ink-faint">
        Mehr dazu in der{" "}
        <Link href="/datenschutz" target="_blank" className="underline">
          Datenschutzerklärung
        </Link>
        . Willst du das nicht, löschst du den Privatbereich unter{" "}
        <Link href="/privat/mehr" className="underline">
          Mehr
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={() => router.replace(pfad)}
        className="mt-4 h-11 w-full rounded-[14px] bg-brand-600 text-[15px] font-semibold text-white"
      >
        Verstanden
      </button>
    </div>
  );
}
