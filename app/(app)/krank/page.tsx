import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { SickDayList } from "./sick-day-list";

/**
 * Die Kranktage hinter der Dashboard-Kachel.
 *
 * Die Kachel nennt eine Zahl; hier stehen die Tage dahinter. Welche Zeilen
 * überhaupt herauskommen, entscheidet Row Level Security: Mitarbeitende
 * sehen ausschliesslich ihre eigenen, die Führung die des Unternehmens.
 * Diese Seite filtert nichts nach – sie zeigt, was die Datenbank freigibt.
 */
export default async function KrankPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const jahr = new Date().getFullYear();
  const fuehrung = session.profile.role !== "employee";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Konto"
        title="Kranktage"
        description={
          fuehrung
            ? `Alle erfassten Kranktage im Jahr ${jahr}.`
            : `Deine erfassten Kranktage im Jahr ${jahr}.`
        }
      />
      <SickDayList jahr={jahr} fuehrung={fuehrung} />
    </div>
  );
}
