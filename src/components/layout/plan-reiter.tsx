"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";

/**
 * Plan – drei Ansichten unter einem Dach: Schichtplan, Besetzung und
 * Ausbildung. Nur ein Wegweiser über den drei Seiten; die Seiten selbst
 * (und der Schichtplan darin) bleiben, wie sie sind.
 *
 * Besetzung und Ausbildung sieht nur die Führung – für alle anderen gibt
 * es nur den Schichtplan, dann braucht es auch keine Reiter.
 */
const REITER = [
  { href: "/schichtplan", label: "Schichtplan" },
  { href: "/besetzung", label: "Besetzung" },
  { href: "/ausbildung", label: "Ausbildung" },
];

export function PlanReiter() {
  const pathname = usePathname();
  const { role } = useSession();
  if (role !== "admin" && role !== "shift_leader") return null;

  return (
    <nav
      aria-label="Plan"
      data-plan-reiter
      className="flex w-full rounded-full border border-line bg-surface p-1 sm:inline-flex sm:w-auto"
    >
      {REITER.map((r) => {
        const aktiv = pathname === r.href;
        return (
          <Link
            key={r.href}
            href={r.href}
            scroll={false}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-center text-[14px] font-semibold transition-colors sm:flex-none",
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
