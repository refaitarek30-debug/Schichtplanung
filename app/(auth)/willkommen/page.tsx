import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Willkommen – Schichtplan" };

/**
 * Freundliche Landeseite nach dem Bestätigungslink aus der Registrierungs-
 * E-Mail. Ersetzt die nackte Supabase-Standardseite, die sonst nach dem
 * Klick erscheint.
 */
export default function WelcomePage() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg">
        <CheckCircle2 className="h-8 w-8 text-ok-fg" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">E-Mail bestätigt</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        Dein Zugang ist jetzt aktiv. Du kannst dich anmelden und dein Unternehmen einrichten –
        Schichten, Mitarbeiter und das Schichtmuster legst du als Administrator selbst fest.
      </p>
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Jetzt anmelden
        </Link>
      </div>
      <p className="mx-auto mt-6 max-w-sm text-[12px] leading-snug text-ink-faint">
        Tipp: Lege zuerst unter „Schichten" dein Schichtmuster an, dann ordne unter „Mitarbeiter"
        jeder Person eine Schichtgruppe A–D zu.
      </p>
    </div>
  );
}
