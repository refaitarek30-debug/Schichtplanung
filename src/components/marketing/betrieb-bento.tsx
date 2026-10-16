import type { ReactNode } from "react";
import { Bell, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kacheln für den Firmenteil der Startseite. Statisch, mit Beispieldaten –
 * Farben und Kürzel wie in der Anwendung (globals.css). Jede Kachel zeigt
 * eine Funktion, die es im Produkt gibt.
 */

type K = "F" | "S" | "N" | "U" | "";
const ZELLE: Record<K, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  "": "bg-surface-sunken text-ink-faint",
};
const PUNKT = { ok: "bg-ok-dot", warn: "bg-warn-dot", crit: "bg-crit-dot" } as const;
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function Kachel({
  titel,
  text,
  children,
  className,
}: {
  titel: string;
  text: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-[24px] border border-line bg-surface p-5 shadow-card sm:p-6", className)}>
      <div aria-hidden className="flex flex-1 flex-col justify-center">
        {children}
      </div>
      <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{titel}</h3>
      <p className="mt-1 text-[14px] leading-snug text-ink-muted">{text}</p>
    </article>
  );
}

function BesetzungBild() {
  const zeilen: { name: string; zeit: string; s: (keyof typeof PUNKT)[] }[] = [
    { name: "Früh", zeit: "06–14", s: ["ok", "ok", "warn", "ok", "ok", "ok", "ok"] },
    { name: "Spät", zeit: "14–22", s: ["ok", "ok", "ok", "crit", "ok", "warn", "ok"] },
    { name: "Nacht", zeit: "22–06", s: ["ok", "warn", "ok", "ok", "ok", "ok", "ok"] },
  ];
  return (
    <div className="rounded-[18px] bg-surface-muted p-3 sm:p-4">
      <div className="grid grid-cols-[3.4rem_repeat(7,minmax(0,1fr))] items-center gap-y-2.5 text-center">
        <span />
        {TAGE.map((t) => (
          <span key={t} className="text-[11px] font-semibold text-ink-faint">
            {t}
          </span>
        ))}
        {zeilen.map((z) => (
          <Zeile key={z.name} z={z} />
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-crit-bg px-3 py-2 text-[12.5px] font-medium text-crit-fg">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Donnerstag Spät: 1 Person zu wenig
      </div>
    </div>
  );
}

function Zeile({ z }: { z: { name: string; zeit: string; s: (keyof typeof PUNKT)[] } }) {
  return (
    <>
      <span className="text-left">
        <span className="block text-[12.5px] font-semibold leading-tight">{z.name}</span>
        <span className="block text-[10.5px] text-ink-faint">{z.zeit}</span>
      </span>
      {z.s.map((s, i) => (
        <span key={i} className="flex justify-center">
          <span className={cn("h-3.5 w-3.5 rounded-full", PUNKT[s], s === "crit" && "ring-4 ring-crit-dot/20")} />
        </span>
      ))}
    </>
  );
}

function AntragBild() {
  return (
    <div className="rounded-[18px] bg-surface-muted p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-[12px] font-semibold text-ink-muted">SK</span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold">S. Krüger · Urlaub</p>
          <p className="text-[12px] text-ink-muted">23.–27. November · 5 Tage</p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-ok-fg">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Besetzung bleibt erfüllt
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] font-semibold">
        <span className="rounded-xl border border-line bg-surface py-2 text-center text-ink-muted">Ablehnen</span>
        <span className="rounded-xl bg-brand-500 py-2 text-center text-white">Genehmigen</span>
      </div>
    </div>
  );
}

function RotationBild() {
  const muster: K[] = ["F", "F", "S", "S", "N", "N", "", ""];
  return (
    <div className="space-y-1.5 rounded-[18px] bg-surface-muted p-3.5">
      {["A", "B", "C", "D"].map((g, gi) => (
        <div key={g} className="flex items-center gap-1.5">
          <span className="w-4 text-[12px] font-bold text-ink-muted">{g}</span>
          {Array.from({ length: 7 }, (_, i) => {
            const k = muster[(i + gi * 2) % muster.length];
            return (
              <span key={i} className={cn("flex h-6 flex-1 items-center justify-center rounded-[6px] text-[10.5px] font-bold", ZELLE[k])}>
                {k}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function QualiBild() {
  const q = [
    { name: "Ersthelfer", ist: 2, min: 1 },
    { name: "Kranführer", ist: 1, min: 1 },
    { name: "Elektrofachkraft", ist: 0, min: 1 },
  ];
  return (
    <ul className="space-y-1.5 rounded-[18px] bg-surface-muted p-3.5">
      {q.map((x) => {
        const ok = x.ist >= x.min;
        return (
          <li key={x.name} className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium", ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg")}>
            <span className="flex items-center gap-1.5">
              {ok ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <TriangleAlert className="h-3.5 w-3.5" />}
              {x.name}
            </span>
            <span className="font-mono">
              {x.ist}/{x.min}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function KontenBild() {
  const konten = [
    { name: "Urlaub", rest: 18, von: 30, farbe: "bg-shift-urlaub" },
    { name: "V-Tage", rest: 4, von: 6, farbe: "bg-shift-vtag" },
    { name: "Altersfreizeit", rest: 2, von: 3, farbe: "bg-brand-500" },
  ];
  return (
    <div className="space-y-3 rounded-[18px] bg-surface-muted p-3.5">
      {konten.map((k) => (
        <div key={k.name}>
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold">{k.name}</span>
            <span className="tnum text-ink-muted">
              <span className="font-semibold text-ink">{k.rest}</span> von {k.von}
            </span>
          </div>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className={cn("block h-full rounded-full", k.farbe)} style={{ width: `${(k.rest / k.von) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function HandyBild() {
  const woche: K[] = ["F", "F", "S", "S", "N", "", ""];
  return (
    <div className="rounded-[18px] bg-surface-muted p-3.5">
      <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold">Urlaub genehmigt</p>
          <p className="truncate text-[11.5px] text-ink-muted">23.–27. November</p>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] font-semibold text-ink-faint">Meine Woche</p>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {woche.map((k, i) => (
          <span key={i} className="text-center">
            <span className="block text-[10px] text-ink-faint">{TAGE[i]}</span>
            <span className={cn("mt-0.5 flex h-7 items-center justify-center rounded-[7px] text-[11px] font-bold", ZELLE[k])}>{k || "–"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function BetriebBento({ extras }: { extras?: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Kachel
        titel="Besetzung auf einen Blick"
        text="Grün, gelb, rot – Lücken fallen auf, bevor die Schicht beginnt."
        className="md:col-span-2"
      >
        <BesetzungBild />
      </Kachel>
      <Kachel titel="Urlaub mit einem Tipp" text="Anträge entscheiden – mit Blick auf die Besetzung.">
        <AntragBild />
      </Kachel>
      <Kachel titel="Rotation für Gruppen A–D" text="Muster einmal festlegen, der Plan füllt sich.">
        <RotationBild />
      </Kachel>
      <Kachel titel="Qualifikationen" text="Mindestanzahl je Schicht – geprüft für jeden Tag.">
        <QualiBild />
      </Kachel>
      <Kachel titel="Konten laufen mit" text="Urlaub, V-Tage und Altersfreizeit – automatisch.">
        <KontenBild />
      </Kachel>
      <Kachel titel="Jeder auf dem Handy" text="Eigene Schichten, Anträge und Benachrichtigungen." className="md:col-span-2 lg:col-span-1">
        <HandyBild />
      </Kachel>
      {extras ? (
        <article className="flex flex-col justify-center rounded-[24px] border border-line bg-surface-muted p-5 sm:p-6 md:col-span-2">
          <h3 className="text-[17px] font-semibold tracking-tight">Und außerdem</h3>
          <div className="mt-4">{extras}</div>
        </article>
      ) : null}
    </div>
  );
}
