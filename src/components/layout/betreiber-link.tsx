"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

/**
 * Link zur Betreiber-Seite – erscheint nur, wenn die angemeldete Person
 * Betreiber ist (die Prüfung macht der Server, siehe /api/betreiber). Für alle
 * anderen bleibt es leer, es gibt nicht einmal einen Hinweis.
 */
export function BetreiberLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const [da, setDa] = useState(false);
  useEffect(() => {
    let aktiv = true;
    fetch("/api/betreiber", { cache: "no-store" })
      .then((r) => aktiv && r.ok && setDa(true))
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, []);
  if (!da) return null;
  return (
    <Link href="/plattform" onClick={onClick} className={className}>
      <BarChart3 className="h-5 w-5 text-ink-muted" strokeWidth={1.8} /> Betreiber
    </Link>
  );
}
