import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";

/**
 * Auswertung nur für die Administration. Alle anderen – auch die
 * Schichtleitung über eine direkt eingegebene Adresse – landen auf der
 * Startseite, bevor die Seite überhaupt geladen wird.
 */
export default async function AuswertungLayout({ children }: { children: ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/dashboard");
  return children;
}
