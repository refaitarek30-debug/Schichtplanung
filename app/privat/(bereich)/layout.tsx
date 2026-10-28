import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { IdleLogout } from "@/components/layout/idle-logout";
import { PrivatProvider } from "@/components/privat/kontext";
import { PrivatRahmen } from "@/components/privat/rahmen";
import { FRIST_PRIVAT, fristFuer } from "@/lib/auth/idle";
import { BereichDrehung } from "@/components/layout/bereich";
import { getAppSession } from "@/lib/auth/session";
import { getPrivatKonto } from "@/lib/privat/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mein Schichtkalender – ShiftNexo", robots: { index: false, follow: false } };

/**
 * Privatbereich (ohne Firma). Zweite Linie hinter der Middleware; die
 * eigentliche Absicherung macht RLS (Migration 0147).
 */
export default async function PrivatLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) redirect("/login");
  const [konto, session] = await Promise.all([getPrivatKonto(), getAppSession()]);
  // Nach dem Austritt erst die Frage „Privat weitermachen?“ (Migration 0194).
  if (session && !session.profile.active && !session.profile.austrittErledigt) redirect("/privat-weiter");
  if (!konto) {
    if (session) redirect("/start");
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5 text-center">
        <h1 className="text-xl font-semibold">Kein Schichtkalender zu diesem Zugang</h1>
        <p className="text-sm text-ink-muted">
          Mit diesem Zugang ist kein persönlicher Schichtkalender verbunden. Melde dich mit einem anderen Konto an.
        </p>
        <form action={signOut}>
          <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">Abmelden</button>
        </form>
      </div>
    );
  }
  // Gleicher Login auch im Betrieb: dann gilt dessen (kürzere) Abmeldefrist auch hier.
  const betrieb = session?.profile.active ? { firma: session.company.name } : null;
  return (
    <PrivatProvider konto={konto} betrieb={betrieb}>
      <BereichDrehung />
      <IdleLogout fristMs={session?.profile.active ? fristFuer(session.profile.role, session.profile.id) : FRIST_PRIVAT} />
      <PrivatRahmen>{children}</PrivatRahmen>
    </PrivatProvider>
  );
}
