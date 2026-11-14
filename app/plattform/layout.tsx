import { konsoleZugang } from "@/lib/auth/konsole";
import { KonsoleRahmen } from "./rahmen";

export const metadata = { title: "Betreiber-Konsole", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Betreiber-Konsole: eigener Rahmen, getrennt von Betrieb und Privat.
 * Jede Seite prüft den Zugang zusätzlich selbst (konsoleZugang, einmal je
 * Anfrage) – ein Rahmen allein schützt keine Seite.
 */
export default async function KonsoleLayout({ children }: { children: React.ReactNode }) {
  const k = await konsoleZugang();
  // Notfallzugang: jede Öffnung der Konsole wird festgehalten (0221).
  if (k.nurLesen) await k.admin.rpc("platform_notfall_merken");
  return (
    <KonsoleRahmen email={k.email} nurLesen={k.nurLesen}>
      {children}
    </KonsoleRahmen>
  );
}
