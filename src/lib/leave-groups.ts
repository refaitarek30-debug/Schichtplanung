import { leaveKindLabels, type LeaveKind, type LiveLeaveRequest } from "@/lib/types";

/**
 * Ein Antrag, wie ihn Mitarbeiter und Führung sehen sollen.
 *
 * In der Datenbank zerfällt ein zusammenhängender Zeitraum in mehrere
 * Zeilen, weil Urlaubstage und V-Tage auf verschiedene Konten gehen. Das
 * ist richtig und bleibt so. Fachlich ist es aber ein Antrag: er wird im
 * Ganzen gestellt, im Ganzen genehmigt oder im Ganzen abgelehnt.
 *
 * Diese Klammer bildet genau das ab. Sie rechnet nichts neu, sie fasst nur
 * zusammen, was die Datenbank über `request_group_id` ohnehin schon
 * zusammengehören lässt.
 */
export interface LeaveRequestGroup {
  /** Stabiler Schlüssel für die Liste. */
  id: string;
  /**
   * Die Zeile, über die gehandelt wird. Genehmigen, Ablehnen und
   * Zurückziehen wirken serverseitig auf die ganze Gruppe – welche Zeile
   * man übergibt, ist deshalb gleichgültig.
   */
  actionId: string;
  employeeId: string;
  employeeName?: string;
  shiftName: string | null;
  startDate: string;
  endDate: string;
  /** Summe über alle Teile. */
  requestedDays: number;
  /** Jede vorkommende Art einmal, in der Reihenfolge des Zeitraums. */
  kinds: LeaveKind[];
  status: LiveLeaveRequest["status"];
  halfDayPeriod: LiveLeaveRequest["halfDayPeriod"];
  reason: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  createdAt: string;
  /** Die einzelnen Zeilen, falls jemand es genau wissen will. */
  parts: LiveLeaveRequest[];
}

/** "Urlaub", oder "Urlaub und V-Tag", wenn beides im Zeitraum steckt. */
export function artenText(kinds: LeaveKind[]): string {
  const namen = kinds.map((k) => leaveKindLabels[k]);
  if (namen.length <= 1) return namen[0] ?? "Urlaub";
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

/**
 * Anträge zu Gesamtzeiträumen zusammenfassen.
 *
 * Geklammert wird ausschliesslich nach `groupId` – also nach dem, was beim
 * Einreichen entstanden ist. Zwei Anträge, die zufällig aneinandergrenzen,
 * aber getrennt gestellt wurden, bleiben getrennt. Ohne `groupId` bildet
 * ein Antrag seine eigene Gruppe; so verhalten sich alle Altanträge, die
 * nie Teil einer gemeinsamen Einreichung waren.
 *
 * Sollte eine Gruppe unterschiedliche Stände enthalten – etwa weil sie vor
 * dieser Umstellung teilweise entschieden wurde – wird sie nach Stand
 * getrennt dargestellt. Ein gemischter Antrag wäre eine Behauptung, die
 * auf keine der beiden Zeilen zutrifft.
 */
export function gruppiereAntraege(requests: LiveLeaveRequest[]): LeaveRequestGroup[] {
  const nachSchluessel = new Map<string, LiveLeaveRequest[]>();

  for (const r of requests) {
    const schluessel = `${r.groupId ?? r.id}|${r.status}`;
    const vorhanden = nachSchluessel.get(schluessel);
    if (vorhanden) vorhanden.push(r);
    else nachSchluessel.set(schluessel, [r]);
  }

  const gruppen: LeaveRequestGroup[] = [];
  for (const [schluessel, teile] of nachSchluessel) {
    const sortiert = [...teile].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const erster = sortiert[0]!;
    const kinds: LeaveKind[] = [];
    for (const t of sortiert) if (!kinds.includes(t.kind)) kinds.push(t.kind);

    gruppen.push({
      id: schluessel,
      actionId: erster.id,
      employeeId: erster.employeeId,
      employeeName: erster.employeeName,
      shiftName: erster.shiftName ?? null,
      startDate: erster.startDate,
      endDate: sortiert.reduce((max, t) => (t.endDate > max ? t.endDate : max), erster.endDate),
      requestedDays: sortiert.reduce((summe, t) => summe + t.requestedDays, 0),
      kinds,
      status: erster.status,
      // Ein halber Tag kann es nur sein, wenn der Antrag aus einer Zeile besteht.
      halfDayPeriod: sortiert.length === 1 ? erster.halfDayPeriod : null,
      reason: erster.reason,
      rejectionReason: sortiert.find((t) => t.rejectionReason)?.rejectionReason ?? null,
      reviewedAt: erster.reviewedAt,
      reviewerName: erster.reviewerName ?? null,
      createdAt: erster.createdAt,
      parts: sortiert,
    });
  }

  return gruppen;
}
