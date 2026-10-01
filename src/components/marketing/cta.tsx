import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Links im Stil der App-Buttons (`@/components/ui/button`). Ein eigener
 * Baustein, weil die Landingpage echte Links braucht – ein <button> in
 * einem <a> wäre ungültiges HTML – und ohne Client-JavaScript auskommt.
 */
const varianten = {
  primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
} as const;

export function CtaLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof varianten;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        size === "lg" ? "px-5 py-3 text-[15px]" : "px-3.5 py-2 text-sm",
        varianten[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Ziele der Handlungsaufforderungen – an einer Stelle, damit sie überall gleich sind. */
export const ZIELE = {
  testen: "/registrieren",
  demo: "/demo",
  anmelden: "/login",
} as const;

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
        SP
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Schichtplan</span>
    </span>
  );
}
