import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { IdleLogout } from "@/components/layout/idle-logout";
import { PrivatProvider } from "@/components/privat/kontext";
import { PrivatRahmen } from "@/components/privat/rahmen";
import { FRIST_PRIVAT } from "@/lib/auth/idle";
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
  const konto = await getPrivatKonto();
  if (!konto) {
    if (await getAppSession()) redirect("/start");
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
  return (
    <PrivatProvider konto={konto}>
      <IdleLogout fristMs={FRIST_PRIVAT} />
      <PrivatRahmen>{children}</PrivatRahmen>
    </PrivatProvider>
  );
}
