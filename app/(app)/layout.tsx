import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SessionProvider } from "@/context/session";
import { getAppSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Zweite Verteidigungslinie hinter der Middleware: ohne gültige Session
 * wird hier serverseitig umgeleitet, bevor eine Seite gerendert wird.
 * Die dritte und entscheidende Linie ist Row Level Security in Supabase.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <SessionProvider mode="demo">
        <AppShell>{children}</AppShell>
      </SessionProvider>
    );
  }

  const session = await getAppSession();
  if (!session) redirect("/login");

  if (!session.profile.active) {
    redirect("/login?fehler=deaktiviert");
  }

  return (
    <SessionProvider mode="live" profile={session.profile} company={session.company}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
