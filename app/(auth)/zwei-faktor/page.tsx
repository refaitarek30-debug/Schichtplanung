import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/lib/auth/actions";
import { safeInternalPath } from "@/lib/security/safe-path";
import { zweiterFaktorOffen } from "@/lib/auth/zwei-faktor";
import { CodeForm } from "./code-form";

export const metadata = { title: "Code eingeben – ShiftNexo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Zweiter Schritt der Anmeldung: Code aus der Authenticator-App (Migration 0219). */
export default async function ZweiFaktorPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  if (!isSupabaseConfigured) redirect("/login");
  const { weiter } = await searchParams;
  const ziel = safeInternalPath(weiter, "/start");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  if (!(await zweiterFaktorOffen(supabase))) redirect(ziel);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Code eingeben</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Öffne deine Authenticator-App (zum Beispiel Microsoft oder Google Authenticator) und gib den 6-stelligen Code
        für ShiftNexo ein.
      </p>
      <CodeForm weiter={ziel} />
      <p className="mt-6 text-[12.5px] leading-relaxed text-ink-faint">
        Handy verloren oder neu? Die Administration deines Betriebs kann die Zwei-Faktor-Anmeldung zurücksetzen. Danach
        richtest du sie neu ein.
      </p>
      <form action={signOut} className="mt-4">
        <button className="text-[13px] font-semibold text-ink-muted hover:text-ink">Abbrechen und abmelden</button>
      </form>
    </div>
  );
}
