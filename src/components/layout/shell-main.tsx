"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Seiten, die auf großen Bildschirmen die volle Breite nutzen dürfen.
 *
 * Der Schichtplan ist eine breite Tabelle – dreißig Tage nebeneinander. In
 * der üblichen Lesebreite (max-w-6xl) blieben rechts und links große
 * Flächen frei, während die Tageszellen eng standen. Alle übrigen Seiten
 * sind Text und Formulare und bleiben bei der angenehmen Lesebreite.
 */
const BREITE_SEITEN = ["/schichtplan"];

export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const breit = BREITE_SEITEN.some((pfad) => pathname === pfad || pathname.startsWith(`${pfad}/`));
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 pb-8 pt-6 sm:px-6",
        breit ? "max-w-6xl lg:max-w-none lg:px-8" : "max-w-6xl",
      )}
    >
      {children}
    </main>
  );
}
