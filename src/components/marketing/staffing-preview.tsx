import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Beispielansicht der Besetzungskontrolle. Statisch, ohne Datenbankzugriff.
 * Die Logik dahinter gibt es in der Anwendung: Mindest- und Sollbesetzung je
 * Schicht sowie eine Mindestanzahl je Qualifikation.
 */
const POSTEN: { label: string; ist: number; soll: number }[] = [
  { label: "Anlagenfahrer", ist: 2, soll: 2 },
  { label: "Messwarte", ist: 1, soll: 1 },
  { label: "Schichtleiter", ist: 1, soll: 1 },
  { label: "Instandhaltung (qualifiziert)", ist: 0, soll: 1 },
];

export function StaffingPreview({ className }: { className?: string }) {
  const fehlend = POSTEN.reduce((n, p) => n + Math.max(0, p.soll - p.ist), 0);
  return (
    <figure className={cn("rounded-card border border-line bg-surface p-5 shadow-pop", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">Frühschicht</p>
          <p className="text-[12px] text-ink-faint">06:00–14:00 · Donnerstag · Beispiel</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-crit-bg px-2.5 py-1 text-xs font-medium text-crit-fg">
          <span className="h-2 w-2 rounded-full bg-crit-dot" aria-hidden />
          Mindestbesetzung reißt
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {POSTEN.map((p) => {
          const ok = p.ist >= p.soll;
          return (
            <li
              key={p.label}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm",
                ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg",
              )}
            >
              <span className="flex items-center gap-2">
                {ok ? (
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="font-medium">{p.label}</span>
              </span>
              <span className="font-mono text-[13px]">
                {p.ist}/{p.soll}
              </span>
            </li>
          );
        })}
      </ul>

      <figcaption className="mt-4 flex items-start gap-2 rounded-xl border border-warn-dot/40 px-3 py-2.5 text-[13px] text-ink">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn-dot" aria-hidden />
        <span>
          {fehlend} qualifizierte Person fehlt. Ein Urlaubsantrag für diesen Tag würde die
          Lücke vergrößern – das zeigt Schichtplan vor der Entscheidung.
        </span>
      </figcaption>
    </figure>
  );
}
