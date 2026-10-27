import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { IdleLogout } from "@/components/layout/idle-logout";
import { StartWeiterleitung } from "@/components/layout/start-weiterleitung";
import { fristFuer } from "@/lib/auth/idle";
import { SessionProvider } from "@/context/session";
import { getAppSession } from "@/lib/auth/session";
import { isProductionMisconfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { PrivacyOnboarding } from "@/components/privacy/privacy-onboarding";
import { getPrivatKonto } from "@/lib/privat/server";
import { GlasProfil, GlasTitelAnpassung } from "@/components/layout/glas-profil";

/**
 * Zweite Verteidigungslinie hinter der Middleware: ohne gültige Session
 * wird hier serverseitig umgeleitet, bevor eine Seite gerendert wird.
 * Die dritte und entscheidende Linie ist Row Level Security in Supabase.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (isProductionMisconfigured) {
    throw new Error("Supabase ist in der Produktion nicht konfiguriert.");
  }
  if (!isSupabaseConfigured) {
    return (
      <SessionProvider mode="demo">
        <AppShell>{children}</AppShell>
      </SessionProvider>
    );
  }

  const session = await getAppSession();
  if (!session) {
    // Privatkonten haben kein Firmenprofil – sonst liefe /login ↔ /start im Kreis.
    if (await getPrivatKonto()) redirect("/privat");
    redirect("/login");
  }

  if (!session.profile.active) {
    redirect("/login?fehler=deaktiviert");
  }

  const privacyOnboardingRequired = await isPrivacyOnboardingRequired(session.profile.id);

  return (
    <SessionProvider mode="live" profile={session.profile} company={session.company}>
      {/* Die Abmeldefrist laeuft auch waehrend der Datenschutzabfrage. Sonst
          bliebe ein unbeaufsichtigtes Geraet mit offener Sitzung stehen,
          nur weil die Abfrage noch nicht beantwortet ist. */}
      {/* Schwebende Glas-Leiste unten und Profil-Knopf – für alle. */}
      <span hidden data-glas-leiste />
      <GlasProfil />
      <GlasTitelAnpassung />
      <IdleLogout fristMs={fristFuer(session.profile.role, session.profile.id)} />
      <StartWeiterleitung startSeite={session.profile.startSeite ?? null} />
      {privacyOnboardingRequired ? (
        <PrivacyOnboarding />
      ) : (
        <AppShell>{children}</AppShell>
      )}
    </SessionProvider>
  );
}

/**
 * Die Datenschutz-Abfrage erscheint nur bei neu angelegten Personen, die sie
 * noch nie beantwortet haben (accepted_at ist leer). Eine neue Fassung der
 * Erklärung löst sie bei bestehenden Personen bewusst nicht erneut aus.
 */
async function isPrivacyOnboardingRequired(userId: string): Promise<boolean> {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data, error } = await supabase
    .from("privacy_settings")
    .select("accepted_at")
    .eq("user_id", userId)
    .maybeSingle();

  // Fail closed: an unreadable or missing privacy record must never be
  // interpreted as an already completed privacy setup.
  if (error || !data) return true;

  return !data.accepted_at;
}
