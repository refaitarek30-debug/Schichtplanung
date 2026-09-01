import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Passwort zurücksetzen – Schichtplan" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Passwort zurücksetzen</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst.
      </p>

      <ResetForm />

      <p className="mt-6 text-center">
        <Link href="/login" className="text-[13px] font-medium text-brand-600 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </div>
  );
}
