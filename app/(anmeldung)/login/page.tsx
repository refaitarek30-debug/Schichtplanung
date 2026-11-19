import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";
import { RegistrierenWahl } from "./registrieren-wahl";

export const metadata = { title: "Anmelden – ShiftNexo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string; art?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
    <div className="w-full rounded-[28px] bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:p-7">
      <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Mit Spitzname oder E-Mail – für Schichtkalender und Betrieb.
      </p>

      {params.fehler === "dienst" ? (
        <Alert tone="error" className="mt-4">
          Der Anmeldedienst antwortet gerade nicht. Das liegt nicht an deinen Zugangsdaten.
          Bitte in ein bis zwei Minuten erneut versuchen – deine Sitzung bleibt so lange
          erhalten.
        </Alert>
      ) : null}

      {params.fehler === "kein_zugang" ? (
        <Alert tone="error" className="mt-4">
          Dein Konto ist angelegt, aber noch keinem Betrieb zugeordnet. Bitte melde dich bei deiner Schichtleitung oder
          Administration – sie kann dir einen neuen Zugangslink schicken.
        </Alert>
      ) : null}

      {params.fehler === "link" || params.fehler === "abgelaufen" || params.fehler === "verbraucht" ? (
        <Alert tone="error" className="mt-4">
          {params.fehler === "verbraucht" && params.art === "passwort"
            ? "Dieser Passwort-Link ist abgelaufen oder wurde schon benutzt. Bitte bei deiner Schichtleitung oder Administration einen neuen Link oder einen Code anfordern. Ein Link gilt nur einmal und nur für begrenzte Zeit."
            : params.fehler === "verbraucht"
            ? "Dieser Einladungslink wurde bereits eingelöst – oder er ist abgelaufen. Wenn du beim ersten Klick ein Passwort vergeben hast, melde dich einfach oben mit E-Mail und Passwort an. Falls nicht: über „Passwort vergessen“ bekommst du sofort einen neuen Link, ohne bei der Administration nachfragen zu müssen."
            : params.fehler === "abgelaufen"
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
    </div>
    <RegistrierenWahl />
    </>
  );
}
