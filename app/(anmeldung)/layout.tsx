import type { ReactNode } from "react";
import Link from "next/link";
import { LegalFooter } from "@/components/layout/legal-footer";

/**
 * Anmeldung (nur /login): ein fester Bildschirm in der Größe des Geräts.
 * Die Seite selbst scrollt nie – öffnet sich die Tastatur, schrumpft der
 * Rahmen mit, und nur bei sehr kleinen Bildschirmen scrollt der Inhalt
 * innerhalb des Rahmens. Verlauf wie das App-Symbol, darauf eine weiße Karte.
 *
 * Impressum und Datenschutz bleiben erreichbar (hier werden bereits
 * personenbezogene Daten erhoben).
 */
export default function AnmeldungLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-anmeldung
      className="privat-schrift fixed inset-0 z-50 overflow-y-auto overscroll-none bg-[linear-gradient(160deg,#2563eb,#7c3aed)] text-ink [-webkit-overflow-scrolling:touch]"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col justify-center gap-5 px-5 py-[max(16px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]">
        <header className="flex justify-center">
          <Link href="/" aria-label="ShiftNexo – Startseite" className="flex items-center gap-2.5 rounded-lg text-white hover:opacity-90">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-[28%] bg-white text-[14px] font-extrabold tracking-[-0.06em] text-[#4f46e5]"
            >
              SN
            </span>
            <span className="text-[18px] font-semibold tracking-tight">ShiftNexo</span>
          </Link>
        </header>

        {children}

        <LegalFooter className="mt-1 text-center text-[11.5px] text-white/75 [&_a]:text-white/80 [&_a:hover]:text-white [&_span]:hidden" />
      </div>
    </div>
  );
}
