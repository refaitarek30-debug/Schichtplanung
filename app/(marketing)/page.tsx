import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Download,
  Heart,
  Moon,
  Repeat,
  ShieldCheck,
  Smartphone,
  Sparkles,
  CalendarDays,
  LogOut,
} from "lucide-react";
import { CtaLink, ZIELE } from "@/components/marketing/cta";
import { PlanPreview } from "@/components/marketing/plan-preview";
import { BetriebBento } from "@/components/marketing/betrieb-bento";
import { RollenUmschalter } from "@/components/marketing/rollen-umschalter";
import { AboBild, AuswertungBild, KalenderHandy, PartnerBild, RotationBild } from "@/components/marketing/privat-vorschau";

const BESCHREIBUNG =
  "Schichtplanung für Produktions- und Schichtbetriebe – mit Urlaub, Besetzungskontrolle und Qualifikationen.";

const META =
  "Kostenloser Schichtkalender mit Schichtfolge, Feiertagen, Partner-Ansicht und Kalender-Abo fürs Handy – und Schichtplanung mit Urlaub und Besetzung für Betriebe.";

export const metadata: Metadata = {
  title: "Schichtplan – kostenloser Schichtkalender und Schichtplanung für Betriebe",
  description: META,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ready-flame.vercel.app"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: "ShiftNexo",
    title: "Dein Schichtkalender. Kostenlos.",
    description: META,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "ShiftNexo" }],
  },
  twitter: {
    card: "summary",
    title: "ShiftNexo – kostenloser Schichtkalender",
    description: META,
  },
};


/* ------------------------------------------------------------------ */
/* Inhalte – nur Funktionen, die es in der Anwendung gibt.             */
/* ------------------------------------------------------------------ */

const HIGHLIGHTS: { icon: ReactNode; titel: string; text: string; bild: ReactNode }[] = [
  {
    icon: <Repeat className="h-5 w-5" />,
    titel: "Schichtfolge in 3 Sekunden",
    text: "Rhythmus antippen – das ganze Jahr ist gefüllt. Einzelne Tage änderst du mit einem Tipp.",
    bild: <RotationBild />,
  },
  {
    icon: <Heart className="h-5 w-5" />,
    titel: "Partner-Ansicht",
    text: "Per Link einladen – in einer Minute verbunden. Ihr seht sofort, wann ihr beide frei habt.",
    bild: <PartnerBild />,
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    titel: "Im Kalender deines Handys",
    text: "Deine Schichten im iPhone- oder Google-Kalender und als Widget – ohne die App zu öffnen.",
    bild: <AboBild />,
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    titel: "Auswertung & Überstunden",
    text: "Schichten zählen, Soll und Ist, Überstunden – für Monat und Jahr.",
    bild: <AuswertungBild />,
  },
];

const EXTRAS: { icon: ReactNode; text: string }[] = [
  { icon: <Sparkles className="h-4 w-4" />, text: "Ohne KI" },
  { icon: <ShieldCheck className="h-4 w-4" />, text: "Daten in der EU" },
  { icon: <CalendarDays className="h-4 w-4" />, text: "Feiertage je Bundesland" },
  { icon: <Download className="h-4 w-4" />, text: "Export als CSV" },
  { icon: <Moon className="h-4 w-4" />, text: "Dunkelmodus" },
  { icon: <Smartphone className="h-4 w-4" />, text: "Als App installierbar" },
  { icon: <LogOut className="h-4 w-4" />, text: "Automatische Abmeldung" },
];

const BRANCHEN = ["Produktion", "Chemie", "Kunststoff", "Maschinenbau", "Logistik"];

const FAQ: { frage: string; antwort: ReactNode }[] = [
  {
    frage: "Was kostet der Schichtkalender?",
    antwort:
      "Für dich als Privatperson nichts – ohne Abo und ohne Werbung. Zum Anlegen reichen ein Spitzname und ein Passwort; eine E-Mail-Adresse kannst du freiwillig hinterlegen, damit du ein vergessenes Passwort zurücksetzen kannst. Dein Konto löschst du jederzeit selbst mit allen Einträgen.",
  },
  {
    frage: "Funktioniert der Kalender auf iPhone und Android?",
    antwort:
      "Ja. Er läuft im Browser und lässt sich auf dem Handy wie eine App auf den Startbildschirm legen. Über das Kalender-Abo erscheinen deine Schichten zusätzlich im Kalender deines Handys – auch als Widget. Neue Einträge holt der Handy-Kalender selbst ab; das kann einige Stunden dauern.",
  },
  {
    frage: "Für welche Unternehmen ist ShiftNexo geeignet?",
    antwort:
      "Für Unternehmen mit festen Schichtmodellen – etwa Produktion, Chemie- und Kunststoffindustrie, Maschinen- und Anlagenbau oder Logistik. Entscheidend ist nicht die Branche, sondern dass in Schichten gearbeitet wird und Urlaub, Abwesenheiten und Besetzung zusammen geplant werden müssen.",
  },
  {
    frage: "Welche Schichtsysteme werden unterstützt?",
    antwort:
      "Schichten legen Sie selbst an – mit Name, Kürzel, Uhrzeiten, Wochentagen sowie Mindest- und Sollbesetzung. Rotierende Schichtgruppen werden über Rotationsmuster abgebildet; derzeit sind bis zu vier Schichtgruppen (A bis D) möglich. Damit lassen sich 2-, 3- und 4-Schicht-Modelle planen. Modelle mit fünf rotierenden Gruppen werden aktuell noch nicht abgebildet.",
  },
  {
    frage: "Können Mitarbeiter ihre eigenen Schichten sehen?",
    antwort:
      "Ja. Mitarbeiter erhalten einen eigenen Zugang über eine Einladung und sehen ihre eigenen Schichten sowie den Schichtplan. Im persönlichen Kalender tragen sie zusätzlich eigene Termine ein und können auf Wunsch ihren Partner oder ihre Partnerin per Link einladen. Die eingeladene Person braucht kein Konto und sieht die Schichten, Abwesenheiten nur als „Urlaub“ ohne Grund. Schichtplan lässt sich auf dem Handy wie eine App installieren. Welche Gründe für Abwesenheiten Kollegen sehen, ist standardmäßig eingeschränkt und kann je Person freigegeben werden.",
  },
  {
    frage: "Kann Urlaub digital beantragt werden?",
    antwort:
      "Ja. Mitarbeiter beantragen Urlaub, V-Tage und weitere Abwesenheitsarten in der Anwendung. Schichtleitung oder Administration genehmigen oder lehnen ab; dabei ist sichtbar, wie sich der Antrag auf die Besetzung auswirkt. Urlaubskonten werden automatisch mitgeführt.",
  },
  {
    frage: "Können Mitarbeiter importiert werden?",
    antwort:
      "Ein Datei-Import ist derzeit nicht vorhanden. Mitarbeiter werden in der Anwendung angelegt; ein Einrichtungsassistent führt nach der Registrierung durch die ersten Schritte.",
  },
  {
    frage: "Gibt es eine Demo?",
    antwort:
      "Ja. Unter „Live-Demo“ erhalten Sie ohne Registrierung einen eigenen Demo-Bereich mit Beispieldaten eines Schichtbetriebs – als Administration, mit offenen Anträgen zum Genehmigen. Der Bereich wird nach 24 Stunden automatisch gelöscht. Für einen dauerhaften Bereich mit eigenen Daten registrieren Sie sich kostenlos.",
  },
  {
    frage: "Wie funktioniert die Besetzungskontrolle?",
    antwort:
      "Je Schicht werden eine Mindest- und eine Sollbesetzung festgelegt, zusätzlich auf Wunsch eine Mindestanzahl je Qualifikation. ShiftNexo zeigt pro Tag, ob die Besetzung erfüllt ist, unter Soll liegt oder die Mindestbesetzung reißt, und prüft Urlaubsanträge vor der Genehmigung dagegen. Die Entscheidung trifft immer ein Mensch.",
  },
  {
    frage: "Wird künstliche Intelligenz eingesetzt?",
    antwort:
      "Nein. ShiftNexo nutzt keine KI-Dienste und gibt keine Daten an KI-Anbieter weiter. Konten, Besetzung und Konflikte werden nach festen, nachvollziehbaren Regeln berechnet; über Anträge entscheidet immer ein Mensch.",
  },
  {
    frage: "Wo werden die Daten gespeichert?",
    antwort:
      "Die Daten liegen in einer Datenbank in der EU (Irland). Jedes Unternehmen hat einen eigenen Bereich; die Trennung wird in der Datenbank durchgesetzt. Einzelheiten stehen in der Datenschutzerklärung.",
  },
];

/* ------------------------------------------------------------------ */

function Kopf({ eyebrow, titel, mitte }: { eyebrow: string; titel: string; mitte?: boolean }) {
  return (
    <div className={mitte ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">{titel}</h2>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* 1. Schichtkalender */}
      <section id="kalender" className="privat relative scroll-mt-16 overflow-hidden border-b border-line">
        {/* Handy: Text, dann gleich der Kalender, dann die Punkte. Breit: Kalender rechts daneben. */}
        <div className="relative mx-auto grid w-full max-w-6xl gap-x-12 gap-y-9 px-4 pb-16 pt-9 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[auto_auto] lg:py-20">
          <div className="lg:self-end">
            <p className="glas inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-ok-dot" aria-hidden />
              Kostenlos · ohne Werbung · ohne E-Mail
            </p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-tight sm:mt-5 sm:text-[52px] lg:text-[58px]">
              Dein Schichtkalender.{" "}
              <span className="text-brand-600">Einfach schön.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-muted sm:mt-5 sm:text-[17px]">
              Schichtfolge einmal eintragen – der Kalender füllt sich von selbst.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
              <CtaLink href={ZIELE.privat} size="lg" className="flex-1 sm:flex-none">
                Kostenlos starten
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
              <CtaLink href={ZIELE.anmelden} size="lg" variant="secondary">
                Anmelden
              </CtaLink>
            </div>
          </div>
          <KalenderHandy className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center lg:justify-self-end" />
          <ul className="grid gap-2 text-[14px] text-ink-muted sm:grid-cols-2 lg:self-start">
            {["Nur Spitzname und Passwort", "In 30 Sekunden startklar", "Für iPhone, Android und PC", "Löschen jederzeit"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-ok-fg" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. Highlights des Kalenders */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Kopf eyebrow="Was ihn besonders macht" titel="Gemacht für Schichtarbeit." />
          <div className="mt-12 space-y-16 sm:space-y-24">
            {HIGHLIGHTS.map((h, i) => (
              <article key={h.titel} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={i % 2 ? "lg:order-2" : undefined}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{h.icon}</span>
                  <h3 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight sm:text-[30px]">{h.titel}</h3>
                  <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-muted">{h.text}</p>
                </div>
                <div className={i % 2 ? "lg:order-1" : undefined}>{h.bild}</div>
              </article>
            ))}
          </div>
          <div className="mt-16 flex justify-center sm:mt-20">
            <CtaLink href={ZIELE.privat} size="lg">
              Kostenlos starten
              <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
          </div>
        </div>
      </section>

      {/* 3. Für Unternehmen */}
      <section id="unternehmen" className="relative scroll-mt-16 overflow-hidden border-y border-line bg-surface-muted">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(to_right,rgb(var(--c-line))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--c-line))_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              Für Unternehmen
            </p>
            <h2 className="mt-5 text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[46px]">
              Der ganze Betrieb.{" "}
              <span className="whitespace-nowrap text-brand-600">Ein Plan.</span>
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-muted">{BESCHREIBUNG}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href={ZIELE.demo} size="lg">
                Live-Demo starten
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
              <CtaLink href={ZIELE.testen} size="lg" variant="secondary">
                Kostenlos testen
              </CtaLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Branchen">
              {BRANCHEN.map((b) => (
                <li key={b} className="rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-muted">
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <PlanPreview kompakt />
        </div>
      </section>

      {/* 4. Funktionen als Kacheln */}
      <section id="funktionen" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Kopf eyebrow="Funktionen" titel="Alles für den Schichtbetrieb." />
          <div className="mt-10">
            <BetriebBento
              extras={
                <ul className="flex flex-wrap gap-2">
                  {EXTRAS.map((e) => (
                    <li key={e.text} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium">
                      <span className="text-brand-600" aria-hidden>
                        {e.icon}
                      </span>
                      {e.text}
                    </li>
                  ))}
                </ul>
              }
            />
          </div>
        </div>
      </section>

      {/* 5. Rollen */}
      <section className="border-y border-line bg-surface-muted py-16 sm:py-24">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <Kopf eyebrow="Für jede Rolle" titel="Jeder sieht, was er braucht." mitte />
          <div className="mt-10">
            <RollenUmschalter />
          </div>
        </div>
      </section>

      {/* 6. Demo */}
      <section id="demo" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-6xl rounded-[28px] bg-[rgb(33_72_204)] px-6 py-12 text-white sm:px-12 sm:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">In 10 Sekunden im eigenen Demo-Betrieb.</h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85">
                Ohne Anmeldung, mit Beispieldaten und offenen Anträgen. Test und Registrierung sind kostenlos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <CtaLink href={ZIELE.demo} size="lg" variant="secondary" className="border-transparent">
                Live-Demo starten
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-surface-muted py-16 sm:py-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <Kopf eyebrow="FAQ" titel="Häufige Fragen" mitte />
          <div className="mt-10 divide-y divide-line rounded-[24px] border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.frage} className="group px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                  <h3>{f.frage}</h3>
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{f.antwort}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Abschluss */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">Leg los – kostenlos.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="privat flex flex-col rounded-[24px] border border-line p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Für dich</p>
              <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Dein Schichtkalender</h3>
              <div className="mt-6">
                <CtaLink href={ZIELE.privat} size="lg">
                  Kostenlos starten
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </CtaLink>
              </div>
            </div>
            <div className="flex flex-col rounded-[24px] border border-line bg-surface-muted p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Für deinen Betrieb</p>
              <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Schichtplanung fürs Team</h3>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaLink href={ZIELE.demo} size="lg">
                  Live-Demo
                </CtaLink>
                <CtaLink href={ZIELE.testen} size="lg" variant="secondary">
                  Kostenlos testen
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
