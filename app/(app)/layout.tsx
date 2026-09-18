import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { IdleLogout } from "@/components/layout/idle-logout";
import { SessionProvider } from "@/context/session";
import { getAppSession } from "@/lib/auth/session";
import { isProductionMisconfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { PrivacyOnboarding } from "@/components/privacy/privacy-onboarding";

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
  if (!session) redirect("/login");

  if (!session.profile.active) {
    redirect("/login?fehler=deaktiviert");
  }

  const privacyOnboardingRequired = await isPrivacyOnboardingRequired(session.profile.id);

  return (
    <SessionProvider mode="live" profile={session.profile} company={session.company}>
      {privacyOnboardingRequired ? (
        <PrivacyOnboarding />
      ) : (
        <>
          <IdleLogout />
          <AppShell>{children}</AppShell>
        </>
      )}
    </SessionProvider>
  );
}

async function isPrivacyOnboardingRequired(userId: string): Promise<boolean> {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data, error } = await supabase
    .from("privacy_settings")
    .select("privacy_notice_version, accepted_at")
    .eq("user_id", userId)
    .maybeSingle();

  // Fail closed: an unreadable or missing privacy record must never be
  // interpreted as an already completed privacy setup.
  if (error || !data) return true;

  return data.privacy_notice_version !== "1.0" || !data.accepted_at;
}
