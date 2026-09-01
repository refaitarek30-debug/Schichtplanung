import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Alert } from "@/components/ui/alert";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Unternehmen registrieren – Schichtplan" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Unternehmen registrieren</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Ein eigener, vollständig getrennter Bereich für dein Unternehmen – du wirst
        automatisch Administrator.
      </p>

      {!isSupabaseConfigured ? (
        <Alert tone="warning" className="mt-4">
          Supabase ist noch nicht konfiguriert. Die Registrierung ist erst im Live-Modus
          verfügbar.
        </Alert>
      ) : null}

      <RegisterForm disabled={!isSupabaseConfigured} />

      <p className="mt-6 text-center">
        <Link href="/login" className="text-[13px] font-medium text-brand-600 hover:underline">
          Schon registriert? Anmelden
        </Link>
      </p>
    </div>
  );
}
