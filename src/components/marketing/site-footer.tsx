import Link from "next/link";
import { Logo, ZIELE } from "./cta";

const SPALTEN = [
  {
    titel: "Produkt",
    links: [
      { href: "/#funktionen", label: "Funktionen" },
      { href: "/#besetzung", label: "Besetzungskontrolle" },
      { href: "/#preise", label: "Preise" },
      { href: ZIELE.demo, label: "Demo" },
    ],
  },
  {
    titel: "Zugang",
    links: [
      { href: ZIELE.anmelden, label: "Anmelden" },
      { href: ZIELE.testen, label: "Kostenlos testen" },
      { href: "/#faq", label: "Häufige Fragen" },
    ],
  },
  {
    titel: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/nutzungsbedingungen", label: "Nutzungsbedingungen" },
      { href: "/avv", label: "AV-Vertrag" },
    ],
  },
  {
    titel: "Kontakt",
    // Die Kontaktdaten stehen im Impressum – eine eigene Kontaktseite gibt es nicht.
    links: [{ href: "/impressum", label: "Kontakt" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Schichtplanung, Urlaub und Besetzung für Produktions- und Schichtbetriebe.
          </p>
        </div>
        {SPALTEN.map((s) => (
          <nav key={s.titel} aria-label={s.titel}>
            <p className="text-[13px] font-semibold text-ink">{s.titel}</p>
            <ul className="mt-3 space-y-2">
              {s.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-ink-muted hover:text-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-[12px] text-ink-faint sm:px-6">
          © {new Date().getFullYear()} Schichtplan
        </p>
      </div>
    </footer>
  );
}
