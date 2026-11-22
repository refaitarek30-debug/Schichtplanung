"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";

/**
 * Plan – Ansichten unter einem Dach: Schichtplan, Tausch und (nur Führung)
 * Besetzung und Ausbildung. Nur ein Wegweiser über den Seiten; die Seiten
 * selbst bleiben, wie sie sind.
 */
const REITER = [
  { href: "/schichtplan", label: "Schichtplan", fuehrung: false },
  { href: "/schichtplan/tausch", label: "Tausch", fuehrung: false },
  { href: "/besetzung", label: "Besetzung", fuehrung: true },
  { href: "/ausbildung", label: "Ausbildung", fuehrung: true },
];

export function PlanReiter() {
  const pathname = usePathname();
  const { role, mode } = useSession();
  const fuehrung = role === "admin" || role === "shift_leader";
  if (mode !== "live" && !fuehrung) return null;
  const reiter = REITER.filter((r) => fuehrung || !r.fuehrung);

  return (
    <nav
      aria-label="Plan"
      data-plan-reiter
      className="flex w-full rounded-full border border-line bg-surface p-1 sm:inline-flex sm:w-auto"
    >
      {reiter.map((r) => {
        const aktiv = pathname === r.href;
        return (
          <Link
            key={r.href}
            href={r.href}
            scroll={false}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full py-2 text-center font-semibold transition-colors sm:flex-none sm:px-4 sm:text-[14px]",
              reiter.length > 3 ? "px-1.5 text-[13px]" : "px-4 text-[14px]",
              aktiv ? "bg-brand-600 text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
