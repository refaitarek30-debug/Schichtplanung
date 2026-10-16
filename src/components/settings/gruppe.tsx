import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bausteine für die Einstellungen: eine Überschrift in Kapitälchen und
 * darunter eine ruhige Karte, deren Zeilen durch feine Linien getrennt sind.
 */
export function Gruppe({
  titel,
  hinweis,
  children,
  className,
}: {
  titel?: string;
  hinweis?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {titel ? (
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{titel}</h2>
      ) : null}
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {children}
      </div>
      {hinweis ? <p className="px-1 text-[12.5px] leading-snug text-ink-muted">{hinweis}</p> : null}
    </section>
  );
}

const ZEILE = "flex w-full gap-x-4 gap-y-2.5 px-4 py-3.5 text-left sm:px-5";

/** Eine Zeile: Titel und Erklärung links, Bedienelement rechts (auf dem Handy darunter). */
export function Zeile({
  titel,
  text,
  rechts,
  unten,
  inline,
  children,
  className,
}: {
  titel: ReactNode;
  text?: ReactNode;
  rechts?: ReactNode;
  /** Bedienelement immer unter dem Text (breite Elemente). */
  unten?: boolean;
  /** Bedienelement immer rechts daneben (Schalter). */
  inline?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
        ZEILE,
        inline
          ? "items-center justify-between"
          : unten || !rechts
            ? "flex-col"
            : "flex-col sm:flex-row sm:items-center sm:justify-between",
        className,
      )}>
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-snug">{titel}</p>
        {text ? <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{text}</p> : null}
      </div>
      {rechts ? <div className="shrink-0">{rechts}</div> : null}
      {children}
    </div>
  );
}

/** Zeile, die zu einer anderen Seite führt. */
export function LinkZeile({ href, titel, text }: { href: string; titel: ReactNode; text?: ReactNode }) {
  return (
    <Link href={href} className={cn(ZEILE, "items-center justify-between transition-colors hover:bg-surface-muted")}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{titel}</span>
        {text ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{text}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
    </Link>
  );
}

/** Auswahlzeile (Einzelauswahl): Häkchen rechts, wenn gewählt. */
export function WahlZeile({
  aktiv,
  titel,
  text,
  onClick,
  disabled,
  name,
  value,
  onChange,
}: {
  aktiv: boolean;
  titel: ReactNode;
  text?: ReactNode;
  /** Als Knopf (sofort wirksam) … */
  onClick?: () => void;
  disabled?: boolean;
  /** … oder als Formularfeld (wirksam beim Speichern). */
  name?: string;
  value?: string;
  onChange?: () => void;
}) {
  const inhalt = (
    <>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{titel}</span>
        {text ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{text}</span> : null}
      </span>
      <Check
        aria-hidden
        className={cn("h-5 w-5 shrink-0 text-brand-600 transition-opacity", aktiv ? "opacity-100" : "opacity-0")}
        strokeWidth={2.4}
      />
    </>
  );
  const basis = cn(
    ZEILE,
    "items-center justify-between transition-colors hover:bg-surface-muted focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-500/40",
    aktiv && "bg-brand-50/60",
  );
  if (name) {
    return (
      <label className={cn(basis, "cursor-pointer")}>
        <input type="radio" name={name} value={value} checked={aktiv} onChange={onChange} className="sr-only" />
        {inhalt}
      </label>
    );
  }
  return (
    <button type="button" role="radio" aria-checked={aktiv} disabled={disabled} onClick={onClick} className={cn(basis, "disabled:opacity-60")}>
      {inhalt}
    </button>
  );
}

/** Ein-/Aus-Schalter. */
export function Schalter({
  an,
  onClick,
  disabled,
  label,
}: {
  an: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        an ? "bg-brand-500" : "bg-surface-sunken",
      )}
    >
      <span
        className={cn(
          "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
          an ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
