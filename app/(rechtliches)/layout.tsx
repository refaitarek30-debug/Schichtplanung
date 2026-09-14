import type { ReactNode } from "react";
import Link from "next/link";
import { LegalFooter } from "@/components/layout/legal-footer";

/**
 * Impressum und Datenschutzerklärung sind Pflichtangaben und müssen ohne
 * Anmeldung erreichbar sein – deshalb ein eigener Bereich außerhalb von
 * `(app)` (setzt eine Sitzung voraus) und `(auth)` (zweispaltiges
 * Anmeldelayout). Die Middleware lässt alles durch, was nicht in
 * PROTECTED_PREFIXES steht; diese beiden Pfade stehen dort bewusst nicht.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
              SP
            </span>
            <span className="text-sm font-semibold tracking-tight">Schichtplan</span>
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium text-brand-600 hover:underline"
          >
            Zur Anmeldung
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-12">{children}</main>

      <LegalFooter />
    </div>
  );
}
