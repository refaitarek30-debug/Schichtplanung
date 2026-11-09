"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { appScroller } from "@/lib/app-scroller";
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

/**
 * Arbeitsseiten der Führung und die Startseite: am PC breiter (bis 1800 px),
 * damit Kacheln und Listen nebeneinander Platz haben. Formulare und Texte
 * (Profil, Einstellungen, Rechtliches) bleiben bei der Lesebreite.
 */
const WEITE_SEITEN = ["/dashboard", "/urlaubsantraege", "/besetzung", "/verwaltung", "/protokoll", "/ausbildung", "/auswertung"];

export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const breit = BREITE_SEITEN.some((pfad) => pathname === pfad || pathname.startsWith(`${pfad}/`));
  const weit = !breit && WEITE_SEITEN.some((pfad) => pathname === pfad || pathname.startsWith(`${pfad}/`));
  // Neue Seite beginnt oben. Next.js setzt beim Wechsel nur die ganze Seite
  // nach oben – auf dem Handy scrollt aber der Inhaltsbereich (app-scroller.ts).
  useEffect(() => {
    appScroller()?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 pb-8 pt-6 sm:px-6",
        breit ? "max-w-none lg:px-6" : weit ? "max-w-6xl xl:max-w-[1800px] xl:px-8" : "max-w-6xl",
      )}
    >
      {children}
    </main>
  );
}
