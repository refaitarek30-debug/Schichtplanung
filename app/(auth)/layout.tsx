import type { ReactNode } from "react";
import Link from "next/link";
import { LegalFooter } from "@/components/layout/legal-footer";

/**
 * Anmeldebereich: ruhig und schnell – oben das Logo, in der Mitte eine Karte
 * mit dem Formular, nichts, was ablenkt. Gilt für Privat und Betrieb.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="privat-schrift relative isolate flex min-h-screen flex-col">
      {/* Hintergrund wie in der App */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-surface-muted [background-image:var(--glas-hinter)]" />
      <header className="flex justify-center px-5 pt-8 sm:pt-12">
        <Link href="/" aria-label="ShiftNexo – Startseite" className="flex items-center gap-2 rounded-lg hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-500 text-[12.5px] font-bold tracking-tight text-white">
            SN
          </span>
          <span className="text-[16px] font-semibold tracking-tight">ShiftNexo</span>
        </Link>
      </header>

      {/* Auf der Anmeldung und der Registrierung werden bereits
          personenbezogene Daten erhoben – Impressum und Datenschutz
          müssen von hier aus erreichbar sein. */}
      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:pt-8">
        <div className="w-full max-w-[420px] rounded-[28px] bg-surface p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_24px_60px_-32px_rgba(17,24,39,0.3)] sm:p-8">
          {children}
        </div>
      </main>
      <LegalFooter className="px-5 pb-6 text-[12px] text-ink-faint" />
    </div>
  );
}
