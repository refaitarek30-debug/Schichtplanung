import Link from "next/link";
import { Menu } from "lucide-react";
import { CtaLink, Logo, ZIELE } from "./cta";

const NAV = [
  { href: "/#funktionen", label: "Funktionen" },
  { href: "/#besetzung", label: "Besetzung" },
  { href: "/#fuer-wen", label: "Für wen" },
  { href: "/#preise", label: "Preise" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Kopfzeile der öffentlichen Seiten. Das Handymenü ist ein <details>-Element:
 * funktioniert ohne JavaScript und braucht keine Client-Komponente.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Schichtplan – Startseite">
          <Logo />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <CtaLink href={ZIELE.anmelden} variant="ghost">
            Anmelden
          </CtaLink>
          <CtaLink href={ZIELE.testen}>Kostenlos testen</CtaLink>
        </div>

        <details className="relative lg:hidden">
          <summary
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-line text-ink [&::-webkit-details-marker]:hidden"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </summary>
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-pop">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface-muted"
              >
                {n.label}
              </Link>
            ))}
            {/* Auf dem Handy stehen die Buttons nicht in der Kopfzeile. */}
            <div className="mt-2 grid gap-2 border-t border-line pt-2 sm:hidden">
              <CtaLink href={ZIELE.testen}>Kostenlos testen</CtaLink>
              <CtaLink href={ZIELE.anmelden} variant="secondary">
                Anmelden
              </CtaLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
