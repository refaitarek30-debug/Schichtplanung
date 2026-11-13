import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/lib/auth/actions";
import { safeInternalPath } from "@/lib/security/safe-path";
import { zielMitWeiter, zweiterFaktorBestaetigt, zweiterFaktorOffen } from "@/lib/auth/zwei-faktor";
import { Einrichten } from "./einrichten";

export const metadata = { title: "Zwei-Faktor-Anmeldung einrichten – ShiftNexo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Zwei-Faktor-Anmeldung einrichten (Migration 0219). Pflicht für Administration und Schichtleitung. */
export default async function EinrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; pflicht?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/login");
  const { weiter, pflicht } = await searchParams;
  const ziel = safeInternalPath(weiter, "/start");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  if (await zweiterFaktorOffen(supabase)) redirect(zielMitWeiter("/zwei-faktor", ziel));
  if (await zweiterFaktorBestaetigt(supabase)) redirect(ziel);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Zwei-Faktor-Anmeldung</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {pflicht
          ? "Für Administration und Schichtleitung ist sie Pflicht: Wer dein Passwort kennt, kommt ohne dein Handy trotzdem nicht hinein."
          : "Mehr Schutz für dein Konto: Wer dein Passwort kennt, kommt ohne dein Handy trotzdem nicht hinein."}
      </p>
      <Einrichten weiter={ziel} />
      {pflicht ? (
        <form action={signOut} className="mt-6">
          <button className="text-[13px] font-semibold text-ink-muted hover:text-ink">Später – jetzt abmelden</button>
        </form>
      ) : (
        <a href={ziel} className="mt-6 inline-block text-[13px] font-semibold text-ink-muted hover:text-ink">
          Abbrechen
        </a>
      )}
    </div>
  );
}
