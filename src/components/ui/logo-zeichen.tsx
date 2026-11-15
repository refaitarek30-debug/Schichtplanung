import { cn } from "@/lib/utils";

/**
 * Das Logo-Zeichen (Entwurf „Kachel“): „SN“ weiß auf einer abgerundeten
 * Kachel mit Blau-Lila-Verlauf. Eine Stelle für App, Startseite, Anmeldung
 * und Betreiber-Konsole. Die Größe kommt über `className` (h-/w-, Schrift).
 */
export function LogoZeichen({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[28%] bg-[linear-gradient(135deg,#2563eb,#7c3aed)] text-[13px] font-extrabold tracking-[-0.06em] text-white",
        className,
      )}
    >
      SN
    </span>
  );
}
