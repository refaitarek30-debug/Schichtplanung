import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Neues Passwort – Schichtplan" };

export default function NewPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Neues Passwort setzen</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Mindestens 8 Zeichen. Danach bist du direkt angemeldet.
      </p>
      <NewPasswordForm />
    </div>
  );
}
