import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rechtstexte sind lang. Diese Bausteine halten sie einheitlich lesbar. */

export function LegalPage({
  title,
  intro,
  updated,
  version,
  children,
}: {
  title: string;
  intro?: string;
  /** Datum der letzten Änderung – gehört sichtbar in jeden Rechtstext. */
  updated: string;
  /** Nur bei der Datenschutzerklärung gesetzt, siehe `VersionTag`. */
  version?: number;
  children: ReactNode;
}) {
  return (
    <article className="rounded-card border border-line bg-surface px-5 py-6 shadow-card sm:px-8 sm:py-8">
      <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
        {title}
        {version ? <VersionTag version={version} /> : null}
      </h1>
      {intro ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{intro}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-ink-faint">Stand: {updated}</p>
      <div className="mt-7 space-y-7">{children}</div>
    </article>
  );
}

export function Abschnitt({
  titel,
  children,
}: {
  titel: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[17px] font-semibold tracking-tight">{titel}</h2>
      {children}
    </section>
  );
}

export function Absatz({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-relaxed text-ink", className)}>{children}</p>;
}

export function Liste({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-ink marker:text-ink-faint">
      {children}
    </ul>
  );
}

/**
 * Sichtbare Lücke im Text. Pflichtangaben dürfen nicht erfunden werden –
 * eine erfundene Anschrift im Impressum ist schlimmer als eine fehlende,
 * weil sie wie eine echte aussieht. Deshalb bleibt die Stelle offen und
 * sticht ins Auge, bis sie ausgefüllt ist.
 */
export function Platzhalter({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[13px] font-medium text-warn-fg">
      [ {children} ]
    </span>
  );
}

/**
 * Kleines Versionszeichen neben „Datenschutz“ – im Footer, in der
 * Registrierung und auf der Erklärung selbst. Steigt mit
 * `DATENSCHUTZ_VERSION`, sobald sich die Erklärung inhaltlich ändert.
 */
export function VersionTag({ version }: { version: number }) {
  return (
    <sup
      className="ml-0.5 text-[9px] font-medium leading-none text-ink-faint"
      title={`Version ${version} der Datenschutzerklärung`}
    >
      v{version}
    </sup>
  );
}

/** Hinweiskasten für Einordnungen, die nicht Teil der Pflichtangaben sind. */
export function Hinweis({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <aside className="rounded-xl border border-line bg-surface-muted px-4 py-3">
      <p className="text-[13px] font-semibold">{titel}</p>
      <div className="mt-1 space-y-2 text-[13px] leading-relaxed text-ink-muted">
        {children}
      </div>
    </aside>
  );
}
