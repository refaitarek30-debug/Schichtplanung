import Link from "next/link";
import { Menu } from "lucide-react";
import { CtaLink, Logo, ZIELE } from "./cta";
import { BereichKnopf, BereichSchalter } from "./bereich";

/* Anker als einfache Links (<a>): auf der Startseite schaltet bereich.tsx
   damit die richtige Hälfte ein, von anderen Seiten führen sie dorthin. */
const NAV = [
  { href: "/#funktionen", label: "Funktionen" },
  { href: "/#preise", label: "Preise" },
  { href: "/#faq", label: "Fragen" },
  { href: ZIELE.demo, label: "Demo" },
];

/**
 * Kopfzeile der öffentlichen Seiten: Logo, in der Mitte der Schalter
 * „Privat | Betrieb“, rechts Anmelden. Das Handymenü ist ein <details>.
 */
export function SiteHeader() {
  return (
    <header className="fluessig sticky top-0 z-40 border-b border-ink/[0.06]">
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label="ShiftNexo – Startseite" className="justify-self-start">
          <Logo nurZeichen className="sm:hidden" />
          <Logo className="hidden sm:flex" />
        </Link>

        <BereichSchalter className="justify-self-center" />

        <div className="flex items-center justify-end gap-1">
          <nav aria-label="Hauptnavigation" className="mr-1 hidden items-center lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-full px-3 py-2 text-[13.5px] text-ink-muted transition-colors hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>
          <a href={ZIELE.anmelden} className="hidden rounded-full px-3 py-2 text-[13.5px] font-medium text-ink transition-colors hover:bg-ink/[0.05] sm:block">
            Anmelden
          </a>
          <BereichKnopf className="hidden sm:inline-flex" />

          <details className="relative lg:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-ink hover:bg-ink/[0.05] [&::-webkit-details-marker]:hidden"
              aria-label="Menü"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-[20px] border border-line bg-surface p-2 shadow-pop">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="block rounded-xl px-3 py-2.5 text-[15px] text-ink hover:bg-surface-muted">
                  {n.label}
                </a>
              ))}
              <div className="mt-2 grid gap-2 border-t border-line pt-2 sm:hidden">
                <CtaLink href={ZIELE.anmelden}>Anmelden</CtaLink>
                <CtaLink href={ZIELE.privat} variant="secondary">
                  Kostenlos starten
                </CtaLink>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
