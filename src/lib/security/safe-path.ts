/**
 * Prüft ein Weiterleitungsziel aus einer Adresse oder einem Formular.
 *
 * Erlaubt sind ausschließlich Pfade innerhalb dieser Anwendung. Alles, was ein
 * Browser als fremde Adresse deuten könnte, fällt auf `fallback` zurück:
 * `//evil.example`, `/\evil.example`, `https://…`, `javascript:…` und
 * Steuerzeichen. Eine einzige Stelle für Anmeldung, Link-Einlösung und
 * Browser-Brücke – so laufen die drei Wege nicht mehr auseinander.
 */
export function safeInternalPath(
  path: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (typeof path !== "string" || path.length === 0 || path.length > 2000) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Steuerzeichen und Backslashes: manche Browser normalisieren sie zu "/".
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return fallback;

  try {
    const parsed = new URL(path, "http://intern.invalid");
    if (parsed.origin !== "http://intern.invalid") return fallback;
  } catch {
    return fallback;
  }
  return path;
}
