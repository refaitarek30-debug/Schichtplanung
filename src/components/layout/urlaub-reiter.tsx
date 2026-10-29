"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/context/session";
import { fetchOffeneEntscheidungen } from "@/lib/data/leave";
import { useAktualisierung } from "@/lib/live-refresh";
import { cn } from "@/lib/utils";

/**
 * Urlaub – der eigene Urlaub und das Entscheiden unter einem Dach. Nur ein
 * Wegweiser über den beiden Seiten; die Seiten selbst bleiben, wie sie sind.
 * Die Zahl zeigt, wie viele Anträge auf eine Entscheidung warten.
 *
 * Entscheiden darf nur die Führung – alle anderen haben nur „Mein Urlaub“,
 * dann braucht es auch keine Reiter.
 */
export function UrlaubReiter() {
  const pathname = usePathname();
  const { role, mode } = useSession();
  const fuehrung = role === "admin" || role === "shift_leader";
  const [zahl, setZahl] = useState(0);

  const laden = useCallback(() => {
    if (!fuehrung || mode !== "live") return;
    fetchOffeneEntscheidungen()
      .then(setZahl)
      .catch(() => undefined);
  }, [fuehrung, mode]);

  useEffect(() => {
    laden();
  }, [laden]);

  // Neuer Antrag oder eine Entscheidung: Zahl auffrischen.
  useAktualisierung(["antraege"], laden);

  if (!fuehrung) return null;

  const reiter = [
    { href: "/urlaub", label: "Mein Urlaub", zahl: 0 },
    { href: "/urlaubsantraege", label: "Entscheiden", zahl },
  ];

  return (
    <nav
      aria-label="Urlaub"
      data-urlaub-reiter
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors sm:flex-none",
              aktiv ? "bg-brand-600 text-white" : "text-ink-muted hover:text-ink",
            )}
          >
            {r.label}
            {r.zahl > 0 ? (
              <span
                data-offen={r.zahl}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crit-dot px-1.5 text-[11.5px] font-bold text-white"
              >
                {r.zahl}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
