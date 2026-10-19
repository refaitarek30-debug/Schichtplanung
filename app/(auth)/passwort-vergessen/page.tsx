import Link from "next/link";
import { CodeForm } from "./reset-form";

export const metadata = { title: "Passwort vergessen – ShiftNexo" };

/**
 * Passwort vergessen: mit einem Code statt per E-Mail. Im Betrieb kommt der
 * Code von der Schichtleitung oder Administration, im Privatbereich aus
 * „Mehr“ (oder vom Support). Danach geht es zum Formular „Neues Passwort“.
 */
export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Passwort vergessen</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Gib deinen Code ein. Danach legst du ein neues Passwort fest.
      </p>

      <CodeForm />

      <div className="mt-6 space-y-2 rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        <p>
          <span className="font-semibold text-ink">Im Betrieb:</span> Den Code bekommst du von deiner Schichtleitung oder
          Administration. Er gilt 24 Stunden.
        </p>
        <p>
          <span className="font-semibold text-ink">Privat:</span> Nimm deinen Wiederherstellungs-Code aus „Mehr“. Kein Code
          gespeichert? Schreib uns – die Kontaktdaten stehen im{" "}
          <Link href="/impressum" className="font-medium text-brand-600 hover:underline">
            Impressum
          </Link>
          .
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link href="/login" className="text-[13px] font-medium text-brand-600 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
