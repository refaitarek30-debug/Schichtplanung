import type { ReactNode } from "react";

/**
 * Kopfzeile innerhalb eines Verwaltungsbereichs.
 *
 * Die drei Bereiche hatten je eine eigene Seite mit eigener `PageHeader`.
 * Unter einer gemeinsamen Seite mit Reitern wäre das zweimal derselbe
 * Titel – hier bleiben deshalb nur die Beschreibung und die Aktion, die
 * zum jeweiligen Bereich gehört.
 */
export function AdminViewHeader({
  description,
  action,
}: {
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
      {action}
    </div>
  );
}
