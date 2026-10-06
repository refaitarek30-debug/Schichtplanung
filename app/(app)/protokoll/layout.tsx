import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";

export const metadata = { title: "Protokoll" };

/**
 * Protokoll nur für ausdrücklich freigeschaltete Personen – nicht für jede
 * Administration. Alle anderen landen auf der Startseite, bevor die Seite
 * geladen wird. Die Daten selbst gibt `protokoll_liste()` ohnehin nur an
 * Freigeschaltete heraus.
 */
export default async function ProtokollLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.profile.protokoll !== true) redirect("/dashboard");
  return children;
}
