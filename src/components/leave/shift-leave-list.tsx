"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { addDays, formatRange } from "@/lib/dates";
import { DataError, fetchMyShiftLeave } from "@/lib/data/leave";
import type { LiveShiftLeaveEntry } from "@/lib/types";
import { leaveKindLabels } from "@/lib/types";

/** Eine Zeile der Liste: ein Zeitraum am Stück, mit allen Arten darin. */
interface LeaveBlock extends Omit<LiveShiftLeaveEntry, "kind"> {
  /** Jede vorkommende Art einmal, in der Reihenfolge des Auftretens. */
  arten: LiveShiftLeaveEntry["kind"][];
}

/**
 * Zieht lückenlos aneinander grenzende Zeiträume derselben Person zusammen.
 *
 * Über die Art hinweg, mit Absicht. Ein Urlaubsantrag wird beim Einreichen
 * automatisch in Urlaubstage und V-Tage zerlegt; wer vom 16. bis 18. frei
 * hat, steht dann als "16.–17. V-Tag" und "18. Urlaub" da. Für die Frage,
 * wer aus der Schicht wann fehlt, ist das eine einzige Abwesenheit – die
 * Aufteilung auf die Konten gehört ins eigene Urlaubskonto, nicht hierher.
 * Welche Arten in der Spanne stecken, nennt die Zeile trotzdem.
 *
 * Nicht zusammengefasst wird, was sich unterschiedlich verhält: ein
 * genehmigter und ein noch offener Abschnitt bleiben getrennt, sonst würde
 * die Zeile den einen Stand über den anderen behaupten. Dasselbe gilt für
 * die Freigabe des Grundes. Überlappungen werden mitgenommen (`<=` statt
 * `===`), damit zwei sich überschneidende Anträge nicht doppelt dastehen.
 */
function buendeln(eintraege: LiveShiftLeaveEntry[]): LeaveBlock[] {
  const sortiert = [...eintraege].sort(
    (a, b) =>
      a.employeeId.localeCompare(b.employeeId) ||
      a.startDate.localeCompare(b.startDate) ||
      a.endDate.localeCompare(b.endDate),
  );

  const bloecke: LeaveBlock[] = [];
  for (const eintrag of sortiert) {
    const letzter = bloecke[bloecke.length - 1];
    const anschluss =
      letzter !== undefined &&
      letzter.employeeId === eintrag.employeeId &&
      letzter.reasonVisible === eintrag.reasonVisible &&
      letzter.status === eintrag.status &&
      eintrag.startDate <= addDays(letzter.endDate, 1);

    if (anschluss) {
      // Der spätere Zeitraum kann ganz im schon erfassten liegen.
      if (eintrag.endDate > letzter.endDate) letzter.endDate = eintrag.endDate;
      if (!letzter.arten.includes(eintrag.kind)) letzter.arten.push(eintrag.kind);
    } else {
      // Kopie, damit das Verlängern oben nicht den geladenen Datensatz ändert.
      const { kind, ...rest } = eintrag;
      bloecke.push({ ...rest, arten: [kind] });
    }
  }

  // Zurück in die Reihenfolge der Liste: nach Beginn, dann nach Name.
  return bloecke.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.employeeName.localeCompare(b.employeeName),
  );
}

/**
 * Wer aus der eigenen Schicht wann fehlt – mit Namen. Für alle Rollen
 * gedacht (nicht nur Führung): jeder soll sehen, wer in seiner eigenen
 * Schicht schon frei hat, um selbst besser planen zu können.
 *
 * Ob dabei „Urlaub“ oder nur „Abwesend“ steht, entscheidet die betroffene
 * Person selbst unter Profil → Datenschutz. Die Entscheidung fällt in der
 * Datenbank (`my_shift_leave.reason_visible`), nicht hier – dieser Baustein
 * zeigt nur an, was der Server herausgibt. Ohne Freigabe kommt auch der
 * Status nicht mit: „offen“ oder „genehmigt“ würde sonst wieder verraten,
 * dass es um einen Urlaubsantrag geht.
 *
 * Direkt aneinander grenzende Zeiträume derselben Person stehen als eine
 * Zeile da (siehe `buendeln`). Wer vom 16. bis 17. und dann noch am 18.
 * frei hat, fehlt am Stück – das sind zwei Anträge, aber nur eine
 * Abwesenheit, und genau die interessiert beim Planen.
 */
export function ShiftLeaveList({ from, days = 60 }: { from: string; days?: number }) {
  const [entries, setEntries] = useState<LiveShiftLeaveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await fetchMyShiftLeave(from, addDays(from, days)));
    } catch (caught) {
      setEntries([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [from, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const bloecke = useMemo(() => (entries ? buendeln(entries) : null), [entries]);

  return (
    <Card>
      <CardHeader
        title="Abwesend in meiner Schicht"
        hint="Deine Schicht bzw. Rotationsgruppe"
      />
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <CardBody className="space-y-2 px-3 py-3">
        {bloecke === null ? (
          <RowSkeleton rows={3} />
        ) : bloecke.length === 0 ? (
          <EmptyState title="Aktuell fehlt niemand aus deiner Schicht." />
        ) : (
          bloecke.map((entry) => (
            <div
              key={`${entry.employeeId}-${entry.startDate}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {entry.isMe ? "Du" : entry.employeeName}
                </span>
                <span className="tnum block text-[12px] text-ink-muted">
                  {formatRange(entry.startDate, entry.endDate)}
                </span>
              </span>
              {entry.reasonVisible ? (
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  {/* Steckt mehr als eine Art in der Spanne, stehen beide
                      da. "Urlaub" allein wäre für eine Spanne, die zur
                      Hälfte aus V-Tagen besteht, schlicht falsch. */}
                  <span className="text-[12px] text-ink-muted">
                    {entry.arten.every((a) => a === null)
                      ? "Abwesend"
                      : entry.arten
                          .filter((a): a is NonNullable<typeof a> => a !== null)
                          .map((a) => leaveKindLabels[a])
                          .join(" + ")}
                  </span>
                  <Badge tone={leaveStatusTone[entry.status]}>
                    {leaveStatusLabel[entry.status]}
                  </Badge>
                </span>
              ) : (
                <Badge tone="neutral">Abwesend</Badge>
              )}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
