import type { ReactNode } from "react";
import Link from "next/link";
import { LogoZeichen } from "@/components/ui/logo-zeichen";
import { LegalFooter } from "@/components/layout/legal-footer";

/**
 * Anmeldung (nur /login): ein fester Bildschirm in der Größe des Geräts.
 * Die Seite selbst scrollt nie – öffnet sich die Tastatur, schrumpft der
 * Rahmen mit, und nur bei sehr kleinen Bildschirmen scrollt der Inhalt
 * innerhalb des Rahmens. Gleicher ruhiger Hintergrund und gleiche Farben
 * wie die App (auch im Dunkelmodus), keine Karte, keine Schatten.
 *
 * Impressum und Datenschutz bleiben erreichbar (hier werden bereits
 * personenbezogene Daten erhoben).
 */
export default function AnmeldungLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-anmeldung
      className="privat-schrift fixed inset-0 z-50 overflow-y-auto overscroll-none bg-surface-muted [background-image:var(--glas-hinter)] text-ink [-webkit-overflow-scrolling:touch]"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center gap-7 px-5 py-[max(16px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-2.5">
          <Link href="/" aria-label="ShiftNexo – Startseite" className="flex items-center gap-2.5 rounded-lg hover:opacity-80">
            <LogoZeichen className="h-9 w-9 text-[14px]" />
            <span className="text-[18px] font-semibold tracking-tight">ShiftNexo</span>
          </Link>
        </header>

        {children}

        <LegalFooter className="mt-1 text-center text-[11.5px] text-ink-faint [&_span]:hidden" />
      </div>
    </div>
  );
}
