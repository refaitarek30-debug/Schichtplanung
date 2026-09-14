/**
 * Die sechzehn Bundesländer mit ihren ISO-Kürzeln, wie sie
 * `ensure_holidays()` in der Datenbank erwartet. Steht hier, weil sowohl
 * die Feiertags-Einstellung als auch der Einrichtungsassistent die Liste
 * brauchen – zwei Kopien laufen irgendwann auseinander.
 */
export const GERMAN_STATES: { code: string; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

/** Name zum Kürzel, für Anzeigen ohne Auswahlfeld. */
export function stateName(code: string | null | undefined): string | null {
  return GERMAN_STATES.find((s) => s.code === code)?.name ?? null;
}
