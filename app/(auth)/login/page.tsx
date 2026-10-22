import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden – ShiftNexo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string; art?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Mit deinem Spitznamen oder deiner E-Mail-Adresse – für den Schichtkalender und für deinen Betrieb.
      </p>

      {params.fehler === "dienst" ? (
        <Alert tone="error" className="mt-4">
          Der Anmeldedienst antwortet gerade nicht. Das liegt nicht an deinen Zugangsdaten.
          Bitte in ein bis zwei Minuten erneut versuchen – deine Sitzung bleibt so lange
          erhalten.
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

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-center text-[15px] font-semibold">Noch kein Konto? Hier registrieren:</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/privat/registrieren"
            className="rounded-xl bg-brand-50 px-3 py-2.5 text-center text-[13.5px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            Privat registrieren
          </Link>
          <Link
            href="/registrieren"
            className="rounded-xl bg-surface-muted px-3 py-2.5 text-center text-[13.5px] font-semibold text-ink hover:bg-surface-sunken"
          >
            Betrieb registrieren
          </Link>
        </div>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-faint">
          Im Betrieb angestellt? Deinen Zugang bekommst du per Einladung von deiner Schichtleitung.
        </p>
      </div>
    </div>
  );
}
