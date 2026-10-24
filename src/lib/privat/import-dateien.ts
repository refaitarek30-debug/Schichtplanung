/**
 * Dateien, die schon im Kalender gewählt wurden (Knopf „Screenshot hochladen“),
 * warten hier auf die Import-Seite. Nur im Arbeitsspeicher dieser Seite – nichts
 * wird gespeichert oder gesendet.
 */
let wartend: File[] = [];

export function merkeImportDateien(dateien: File[]): void {
  wartend = dateien;
}

/** Holt die wartenden Dateien und leert den Merker (jede Auswahl wird nur einmal verwendet). */
export function holeImportDateien(): File[] {
  const d = wartend;
  wartend = [];
  return d;
}
