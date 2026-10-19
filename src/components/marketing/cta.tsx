import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Links im Stil von Buttons für die öffentlichen Seiten. Ein eigener
 * Baustein, weil die Landingpage echte Links braucht – ein <button> in
 * einem <a> wäre ungültiges HTML – und ohne Client-JavaScript auskommt.
 */
const varianten = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "bg-ink/[0.06] text-ink hover:bg-ink/[0.1]",
  ghost: "text-brand-600 hover:underline",
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
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        size === "lg" ? "px-6 py-3 text-[16px]" : "px-4 py-2 text-[14px]",
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
  privat: "/privat/registrieren",
  demo: "/demo",
  anmelden: "/login",
} as const;

export function Logo({ className, nurZeichen = false }: { className?: string; nurZeichen?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-500 text-[12.5px] font-bold tracking-tight text-white">
        SN
      </span>
      {nurZeichen ? null : <span className="text-[16px] font-semibold tracking-tight">ShiftNexo</span>}
    </span>
  );
}
