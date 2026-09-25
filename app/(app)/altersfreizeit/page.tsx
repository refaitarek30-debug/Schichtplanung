import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { AgeLeaveTable } from "./age-leave-table";

/**
 * Altersfreizeit prüfen und festlegen – ausschließlich für die
 * Administration und Schichtleitung tragen hier den AF-Stundenstand ein.
 *
 * Die Rolle wird hier ein zweites Mal geprüft, obwohl `age_leave_overview()`
 * in der Datenbank ohnehin abweist. Das ist kein Ersatz, sondern spart der
 * betroffenen Person eine Seite, auf der nur eine Fehlermeldung stünde.
 */
export default async function AgeLeavePage() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin" && session.profile.role !== "shift_leader") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Altersfreizeit"
        description="Aktuellen Stundenstand eintragen – darauf wird aufgebaut: +0,83 Std. je gearbeitetem Tag, −8 Std. je AF-Tag."
      />
      <AgeLeaveTable />
    </div>
  );
}
