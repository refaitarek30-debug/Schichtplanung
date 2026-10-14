"use client";

import { useLokalNachLaden } from "@/components/kalender/lokal";
import { cn } from "@/lib/utils";

/** Schlüssel im Browser: „schon gesehen“ für eine neue Funktion. */
export function neuGesehenSchluessel(name: string) {
  return `schichtplan.neu-gesehen.${name}`;
}

/**
 * Kleines „Neu“ an einem Menüpunkt, bis die Person die Seite einmal
 * geöffnet hat. Auf dem Server und vor dem Laden unsichtbar, damit es
 * nicht bei allen kurz aufblitzt, die es längst gesehen haben.
 */
export function NeuMarke({ name, className }: { name: string; className?: string }) {
  const gesehen = useLokalNachLaden(neuGesehenSchluessel(name), false, true);
  if (gesehen) return null;
  return (
    <span
      className={cn(
        "rounded-full bg-crit-dot px-1.5 py-px text-[9px] font-bold uppercase leading-tight tracking-wide text-white",
        className,
      )}
    >
      Neu
    </span>
  );
}
