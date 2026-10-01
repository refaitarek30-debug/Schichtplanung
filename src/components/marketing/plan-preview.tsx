import { cn } from "@/lib/utils";

/*
 * Statische Vorschau des Schichtplans – mit den echten Farben und Kürzeln
 * der Anwendung (globals.css), aber mit erfundenen Beispieldaten. Hier wird
 * nichts aus der Datenbank geladen.
 */

type Kuerzel = "F" | "S" | "N" | "U" | "K" | "V" | "";

const ZELLE: Record<Kuerzel, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  K: "bg-shift-krank text-shift-krank-ink",
  V: "bg-shift-vtag text-shift-vtag-ink",
  "": "bg-surface-muted text-ink-faint",
};

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const ZEILEN: { gruppe: string; name: string; tage: Kuerzel[] }[] = [
  { gruppe: "A", name: "J. Becker", tage: ["F", "F", "S", "S", "N", "N", ""] },
  { gruppe: "A", name: "L. Schmitz", tage: ["F", "F", "S", "S", "N", "N", ""] },
  { gruppe: "B", name: "M. Wagner", tage: ["S", "S", "N", "N", "", "", "F"] },
  { gruppe: "B", name: "S. Krüger", tage: ["S", "U", "U", "U", "", "", "F"] },
  { gruppe: "C", name: "T. Hoffmann", tage: ["N", "N", "", "", "F", "F", "S"] },
  { gruppe: "C", name: "A. Yilmaz", tage: ["N", "K", "", "", "F", "F", "S"] },
  { gruppe: "D", name: "R. Neumann", tage: ["", "", "F", "F", "S", "S", "N"] },
  { gruppe: "D", name: "K. Braun", tage: ["", "", "F", "V", "S", "S", "N"] },
];

/** Besetzung je Tag: grün erfüllt, gelb unter Soll, rot unter Mindestbesetzung. */
const BESETZUNG: ("ok" | "warn" | "crit")[] = ["ok", "warn", "warn", "crit", "ok", "ok", "ok"];

const PUNKT = { ok: "bg-ok-dot", warn: "bg-warn-dot", crit: "bg-crit-dot" } as const;

export function PlanPreview({ kompakt = false, className }: { kompakt?: boolean; className?: string }) {
  const zeilen = kompakt ? ZEILEN.slice(0, 6) : ZEILEN;
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface shadow-pop",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold">Schichtplan · KW 12</p>
          <p className="text-[11px] text-ink-faint">Beispieldaten</p>
        </div>
        <div className="flex gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] border-separate border-spacing-1 px-2 py-2 text-center text-[12px]">
          <caption className="sr-only">
            Beispiel eines Wochenplans mit Schichtgruppen, Schichten und Abwesenheiten
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-1 text-left text-[11px] font-medium text-ink-faint">
                Gruppe · Name
              </th>
              {TAGE.map((t) => (
                <th key={t} scope="col" className="w-9 text-[11px] font-medium text-ink-faint">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.name}>
                <th scope="row" className="whitespace-nowrap px-1 text-left font-normal">
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-surface-sunken text-[10px] font-semibold text-ink-muted">
                    {z.gruppe}
                  </span>
                  <span className="text-ink">{z.name}</span>
                </th>
                {z.tage.map((k, i) => (
                  <td
                    key={i}
                    className={cn("h-8 rounded-md font-mono text-[12px] font-medium", ZELLE[k])}
                  >
                    {k || "·"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-1 pt-1 text-left text-[11px] font-medium text-ink-faint">
                Besetzung
              </th>
              {BESETZUNG.map((b, i) => (
                <td key={i} className="pt-1">
                  <span
                    className={cn("mx-auto block h-2.5 w-2.5 rounded-full", PUNKT[b])}
                    aria-label={b === "ok" ? "erfüllt" : b === "warn" ? "unter Soll" : "unter Mindestbesetzung"}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {!kompakt ? (
        <figcaption className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line px-4 py-3 text-[11px] text-ink-muted">
          {(
            [
              ["F", "Früh"],
              ["S", "Spät"],
              ["N", "Nacht"],
              ["U", "Urlaub"],
              ["V", "V-Tag"],
              ["K", "Krank"],
            ] as [Kuerzel, string][]
          ).map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold", ZELLE[k])}>
                {k}
              </span>
              {l}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ok-dot" /> erfüllt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warn-dot" /> unter Soll
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-crit-dot" /> unter Mindestbesetzung
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
