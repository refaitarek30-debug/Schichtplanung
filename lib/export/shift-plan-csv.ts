import { formatDE, fromISO, WEEKDAY_SHORT } from "@/lib/dates";
import type { LiveShiftPlanCell } from "@/lib/types";

/**
 * Jahresübersicht als Tabellendatei für Excel.
 *
 * Bewusst CSV statt echtem .xlsx: Excel öffnet CSV direkt per Doppelklick,
 * es braucht keine zusätzliche Programmbibliothek im Projekt, und die Datei
 * lässt sich hinterher frei weiterbearbeiten. Semikolon als Trennzeichen und
 * ein BOM am Anfang sorgen dafür, dass deutsches Excel die Spalten korrekt
 * aufteilt und Umlaute richtig darstellt (ohne BOM zeigt Excel "Frühschicht"
 * als "FrÃ¼hschicht").
 */

/** Wert für CSV absichern: Trennzeichen, Anführungszeichen und Zeilenumbrüche. */
function csvValue(value: string): string {
  const needsQuotes = /[;"\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export interface ShiftPlanCsvOptions {
  /** Überschrift, z. B. "Schichtplan 2027 – Schicht C". */
  title: string;
  dates: string[];
  cells: LiveShiftPlanCell[];
}

export function buildShiftPlanCsv({ title, dates, cells }: ShiftPlanCsvOptions): string {
  // Zellen nach Mitarbeiter bündeln, Reihenfolge: Schichtgruppe, dann Name.
  const byEmployee = new Map<
    string,
    { name: string; team: string | null; number: string | null; days: Map<string, string> }
  >();

  for (const cell of cells) {
    if (!byEmployee.has(cell.employeeId)) {
      byEmployee.set(cell.employeeId, {
        name: cell.employeeName,
        team: cell.rotationTeam,
        number: cell.personnelNumber,
        days: new Map(),
      });
    }
    // Abwesenheit überlagert die Schicht – gleiche Logik wie in der Anzeige.
    const code = cell.absenceCode ?? cell.shiftCode ?? "";
    byEmployee.get(cell.employeeId)!.days.set(cell.day, code);
  }

  const employees = [...byEmployee.values()].sort((a, b) => {
    const teamA = a.team ?? "ZZ";
    const teamB = b.team ?? "ZZ";
    if (teamA !== teamB) return teamA.localeCompare(teamB);
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  lines.push(csvValue(title));
  lines.push(csvValue(`Erstellt am ${formatDE(new Date().toISOString().slice(0, 10))}`));
  lines.push("");

  // Kopfzeile 1: Wochentag, Kopfzeile 2: Datum – wie im gewohnten Plan.
  lines.push(
    ["Schicht", "Personalnr.", "Mitarbeiter", ...dates.map((iso) => WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7])]
      .map(csvValue)
      .join(";"),
  );
  lines.push(
    ["", "", "", ...dates.map((iso) => formatDE(iso))].map(csvValue).join(";"),
  );

  for (const employee of employees) {
    lines.push(
      [
        employee.team ? `Schicht ${employee.team}` : "ohne Gruppe",
        employee.number ?? "",
        employee.name,
        ...dates.map((iso) => employee.days.get(iso) ?? ""),
      ]
        .map(csvValue)
        .join(";"),
    );
  }

  lines.push("");
  lines.push(csvValue("Legende"));
  for (const [code, label] of [
    ["F", "Frühschicht"],
    ["S", "Spätschicht"],
    ["N", "Nachtschicht"],
    ["U", "Urlaub (genehmigt)"],
    ["u", "Urlaub beantragt"],
    ["K", "Krank"],
    ["FB", "Schulung"],
    ["", "frei laut Schichtmuster"],
  ]) {
    lines.push([code, label].map(csvValue).join(";"));
  }

  // BOM, damit Excel UTF-8 erkennt.
  return "\ufeff" + lines.join("\r\n");
}

/** Löst den Download im Browser aus. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
