"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Scale, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmployeesView } from "@/components/admin/employees-view";
import { ShiftsView } from "@/components/admin/shifts-view";
import { RulesView } from "@/components/admin/rules-view";
import { useSession } from "@/context/session";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type Bereich = "mitarbeiter" | "schichten" | "regeln";

const BEREICHE: {
  wert: Bereich;
  label: string;
  icon: typeof Users;
  roles: Role[];
}[] = [
  { wert: "mitarbeiter", label: "Mitarbeiter", icon: Users, roles: ["shift_leader", "admin"] },
  { wert: "schichten", label: "Schichten", icon: Layers, roles: ["admin"] },
  { wert: "regeln", label: "Regeln", icon: Scale, roles: ["admin"] },
];

/**
 * Verwaltung – Mitarbeiter, Schichten und Regeln auf einer Seite.
 *
 * Vorher drei getrennte Einträge in der Navigation für Dinge, die man beim
 * Einrichten ohnehin nacheinander durchgeht. Der gewählte Bereich steht in
 * der Adresse (`?bereich=`), damit Lesezeichen, Neuladen und der
 * Zurück-Knopf funktionieren.
 *
 * Die Reiter sind nach Rolle gefiltert: die Schichtleitung sieht nur die
 * Mitarbeiter. Das ist Bequemlichkeit, keine Absicherung – die liegt in
 * den Server-Aktionen und in Row Level Security.
 */
export default function VerwaltungPage() {
  return (
    <Suspense fallback={null}>
      <VerwaltungInhalt />
    </Suspense>
  );
}

function VerwaltungInhalt() {
  const router = useRouter();
  const params = useSearchParams();
  const { role } = useSession();

  const erlaubt = BEREICHE.filter((b) => b.roles.includes(role));
  const gewuenscht = params.get("bereich") as Bereich | null;
  const aktiv =
    erlaubt.find((b) => b.wert === gewuenscht)?.wert ?? erlaubt[0]?.wert ?? "mitarbeiter";

  function wechseln(bereich: Bereich) {
    // replace statt push: das Blättern zwischen Reitern soll nicht den
    // Zurück-Knopf zumüllen.
    router.replace(`/verwaltung?bereich=${bereich}`, { scroll: false });
  }

  if (erlaubt.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Verwaltung" title="Verwaltung" />
        <Alert tone="warning">Für diesen Bereich fehlt dir die Berechtigung.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Verwaltung" title="Verwaltung" />

      <div
        role="tablist"
        aria-label="Verwaltungsbereich"
        className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
      >
        {erlaubt.map(({ wert, label, icon: Icon }) => (
          <button
            key={wert}
            role="tab"
            aria-selected={aktiv === wert}
            onClick={() => wechseln(wert)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              aktiv === wert
                ? "bg-brand-500 text-white"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {aktiv === "mitarbeiter" ? (
        <EmployeesView />
      ) : aktiv === "schichten" ? (
        <ShiftsView />
      ) : (
        <RulesView />
      )}
    </div>
  );
}
