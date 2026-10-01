import type { Metadata } from "next";
import { Clock, ShieldCheck, UserCog } from "lucide-react";
import { CtaLink, ZIELE } from "@/components/marketing/cta";
import { DemoStart } from "@/components/marketing/demo-start";
import { PlanPreview } from "@/components/marketing/plan-preview";

export const metadata: Metadata = {
  title: "Live-Demo – Schichtplan",
  description:
    "Schichtplan ohne Registrierung ausprobieren: ein eigener Demo-Bereich mit Beispieldaten eines Schichtbetriebs, 24 Stunden gültig.",
};

/*
 * Live-Demo.
 *
 * Bewusst KEIN gemeinsames Demo-Konto: ein öffentlich bekanntes Passwort zu
 * einem Mandanten im Produktivsystem wäre ein Sicherheitsrisiko, und
 * Besucher sähen gegenseitig ihre Eingaben. Stattdessen legt „Live-Demo
 * starten“ je Besucher ein eigenes Konto und eine eigene Kopie der
 * Beispielfirma an (src/lib/demo/actions.ts, demo_create in der Datenbank).
 * Nach 24 Stunden wird beides automatisch gelöscht.
 */
export default function DemoPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Live-Demo</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight sm:text-[42px]">
            Schichtplan live ausprobieren
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            Mit einem Klick erhalten Sie einen eigenen Demo-Bereich mit den Beispieldaten eines
            Schichtbetriebs: rund 50 Mitarbeiter in vier Schichtgruppen, Qualifikationen,
            Urlaubskonten, Abwesenheiten und offene Anträge zum Genehmigen. Ohne Registrierung.
          </p>

          <ul className="mt-6 space-y-3 text-[14px] leading-snug">
            <li className="flex gap-3">
              <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              Sie sind als Administration angemeldet und sehen alles. Über „Ansicht“ können Sie
              auch die Sicht von Schichtleitung und Mitarbeitern ausprobieren.
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              Der Demo-Bereich wird nach 24 Stunden automatisch gelöscht. Nach 10 Minuten ohne
              Aktivität endet die Sitzung; dann starten Sie einfach eine neue Demo.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              Ihr Demo-Bereich ist von allen anderen getrennt. Einladungen und E-Mails sind
              abgeschaltet. Bitte geben Sie keine echten Personendaten ein.
            </li>
          </ul>

          <div className="mt-8">
            <DemoStart />
          </div>
          <p className="mt-4 text-[13px] text-ink-muted">
            Lieber gleich mit eigenen Daten?{" "}
            <a href={ZIELE.testen} className="font-medium text-brand-600 hover:underline">
              Kostenlos registrieren
            </a>
          </p>
          <p className="mt-2 text-[12px] leading-snug text-ink-faint">
            Mit dem Start gelten die{" "}
            <a href="/nutzungsbedingungen" className="underline underline-offset-2">
              Nutzungsbedingungen
            </a>
            . Hinweise zur Verarbeitung stehen in der{" "}
            <a href="/datenschutz" className="underline underline-offset-2">
              Datenschutzerklärung
            </a>
            .
          </p>
        </div>
        <div className="space-y-4">
          <PlanPreview />
          <div className="hidden justify-end lg:flex">
            <CtaLink href="/#funktionen" variant="ghost">
              Alle Funktionen ansehen
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
