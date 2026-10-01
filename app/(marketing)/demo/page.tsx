import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CtaLink, ZIELE } from "@/components/marketing/cta";
import { PlanPreview } from "@/components/marketing/plan-preview";

export const metadata: Metadata = {
  title: "Live-Demo – Schichtplan",
  description:
    "Die öffentliche Live-Demo von Schichtplan wird vorbereitet. Bis dahin können Unternehmen Schichtplan kostenlos mit einem eigenen Bereich testen.",
};

/*
 * Vorgesehene Route für die öffentliche Demo.
 *
 * Bewusst KEIN gemeinsames Demo-Konto im Produktivsystem: ein öffentlich
 * bekanntes Passwort zu einem echten Mandanten wäre ein Sicherheitsrisiko.
 * Eine echte Demo braucht eine eigene, regelmäßig zurückgesetzte Umgebung
 * (oder je Besucher einen frischen, befristeten Mandanten). Bis es die gibt,
 * erklärt diese Seite den Stand und führt zur Registrierung.
 */
export default function DemoPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Live-Demo</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight sm:text-[42px]">
            Die Live-Demo wird gerade vorbereitet.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            Bald können Sie Schichtplan hier mit vorbereiteten Beispieldaten ausprobieren – ohne
            Registrierung. Bis dahin legen Sie in wenigen Minuten einen eigenen, kostenlosen
            Testbereich für Ihr Unternehmen an und richten Schichten und Mitarbeiter selbst ein.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaLink href={ZIELE.testen} size="lg">
              Kostenlos testen
              <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
            <CtaLink href="/#funktionen" size="lg" variant="secondary">
              Funktionen ansehen
            </CtaLink>
          </div>
          <p className="mt-6 flex items-start gap-2 text-[13px] leading-snug text-ink-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok-dot" aria-hidden />
            Ihr Testbereich ist von anderen Unternehmen getrennt. Die Daten liegen in der EU.
          </p>
        </div>
        <PlanPreview />
      </div>
    </section>
  );
}
