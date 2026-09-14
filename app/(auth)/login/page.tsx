import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden – Schichtplan" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Mit der E-Mail-Adresse, die dein Unternehmen hinterlegt hat.
      </p>

      {params.fehler === "inaktiv" ? (
        <Alert tone="warning" className="mt-4">
          Du wurdest nach 30 Minuten ohne Aktivität automatisch abgemeldet. Bitte melde
          dich erneut an.
        </Alert>
      ) : null}

      {params.fehler === "link" || params.fehler === "abgelaufen" ? (
        <Alert tone="error" className="mt-4">
          {params.fehler === "abgelaufen"
            ? "Dieser Einladungslink ist abgelaufen oder wurde schon benutzt. Jeder Link gilt 24 Stunden und lässt sich nur einmal einlösen – bitte bei der Administration einen neuen anfordern."
            : "Der Link ist unvollständig. Bitte ihn komplett aus der Nachricht kopieren oder unten einen neuen anfordern."}
        </Alert>
      ) : null}

      {!isSupabaseConfigured ? (
        <Alert tone="warning" className="mt-4">
          Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus –{" "}
          <Link href="/dashboard" className="underline">
            direkt zum Dashboard
          </Link>
          .
        </Alert>
      ) : null}

      <LoginForm next={params.weiter ?? ""} disabled={!isSupabaseConfigured} />

      <p className="mt-6 text-[13px] text-ink-faint">
        Noch kein Zugang? Zugänge werden von der Administration angelegt – melde dich
        bei deiner Schichtleitung.
      </p>
      <p className="mt-2 text-center">
        <Link
          href="/registrieren"
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Neues Unternehmen registrieren
        </Link>
      </p>
    </div>
  );
}
