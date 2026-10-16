import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  LayoutGrid,
  LogOut,
  UserCheck,
  CalendarHeart,
  ArrowRight,
  Check,
  Heart,
  Repeat,
  BarChart3,
  BadgeCheck,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Cog,
  Download,
  Factory,
  FlaskConical,
  Layers,
  MessageSquareWarning,
  Plane,
  ShieldCheck,
  Smartphone,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { CtaLink, ZIELE } from "@/components/marketing/cta";
import { PlanPreview } from "@/components/marketing/plan-preview";
import { StaffingPreview } from "@/components/marketing/staffing-preview";
import { AboBild, AuswertungBild, KalenderHandy, PartnerBild, RotationBild } from "@/components/marketing/privat-vorschau";

const BESCHREIBUNG =
  "Schichtplan digitalisiert die Schichtplanung für Produktions- und Schichtbetriebe – inklusive Urlaubsverwaltung, Besetzungskontrolle und Qualifikationen.";

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
    siteName: "Schichtplan",
    title: "Dein Schichtkalender. Kostenlos.",
    description: META,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Schichtplan" }],
  },
  twitter: {
    card: "summary",
    title: "Schichtplan – kostenloser Schichtkalender",
    description: META,
  },
};

/* ------------------------------------------------------------------ */
/* Inhalte                                                             */
/* Nur Funktionen, die es in der Anwendung gibt (Stand: Code und Schema). */
/* ------------------------------------------------------------------ */

const PROBLEME = [
  "Schichtpläne liegen in Excel-Dateien, die nur eine Person sicher bearbeiten kann.",
  "Änderungen laufen per WhatsApp, Zettel oder auf Zuruf – und kommen nicht bei allen an.",
  "Urlaubsplanung und Schichtplan sind getrennt, Konflikte fallen erst spät auf.",
  "Niemand sieht auf einen Blick, ob eine Schicht ausreichend besetzt ist.",
  "Kurzfristig fehlt die qualifizierte Person – bemerkt wird es erst in der Schicht.",
  "Schichtleitung und Mitarbeiter stimmen sich mühsam von Hand ab.",
];

const KERNFUNKTIONEN: { icon: ReactNode; titel: string; text: string }[] = [
  {
    icon: <CalendarDays className="h-5 w-5" />,
    titel: "Schichtplanung",
    text: "Schichten digital planen, bearbeiten und übersichtlich darstellen – mit Rotationsmustern für ganze Schichtgruppen.",
  },
  {
    icon: <Plane className="h-5 w-5" />,
    titel: "Urlaubsverwaltung",
    text: "Urlaubsanträge digital stellen und bearbeiten, direkt verbunden mit dem Schichtplan und den Urlaubskonten.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    titel: "Besetzungskontrolle",
    text: "Erkennen, wenn eine Schicht unter Soll- oder Mindestbesetzung fällt – bevor ein Antrag genehmigt wird.",
  },
  {
    icon: <BadgeCheck className="h-5 w-5" />,
    titel: "Qualifikationen",
    text: "Hinterlegen, wer für welche Aufgabe qualifiziert ist, und je Schicht festlegen, wie viele davon mindestens da sein müssen.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    titel: "Mitarbeiterverwaltung",
    text: "Mitarbeiter, Rollen, Schichtgruppen, Qualifikationen sowie Eintritts- und Austrittsdaten zentral verwalten.",
  },
  {
    icon: <ClipboardCheck className="h-5 w-5" />,
    titel: "Genehmigungen",
    text: "Urlaub, V-Tage und weitere Abwesenheitsarten strukturiert beantragen, prüfen und genehmigen oder ablehnen.",
  },
];

const ZIELGRUPPEN: { icon: ReactNode; titel: string }[] = [
  { icon: <Factory className="h-5 w-5" />, titel: "Produktionsbetriebe" },
  { icon: <FlaskConical className="h-5 w-5" />, titel: "Chemieindustrie" },
  { icon: <Boxes className="h-5 w-5" />, titel: "Kunststoffindustrie" },
  { icon: <Cog className="h-5 w-5" />, titel: "Maschinen- und Anlagenbau" },
  { icon: <Truck className="h-5 w-5" />, titel: "Logistik" },
  { icon: <Building2 className="h-5 w-5" />, titel: "Weitere Unternehmen mit Schichtbetrieb" },
];

const ROLLEN = [
  {
    titel: "Betriebsleitung",
    kurz: "Mehr Übersicht, weniger manueller Verwaltungsaufwand.",
    punkte: [
      "Schichten, Regeln und Mindestbesetzung zentral festlegen",
      "Urlaubs-, V-Tage- und Stundenkonten an einer Stelle",
      "Mitarbeiter einladen und Rollen vergeben",
    ],
  },
  {
    titel: "Schichtleitung",
    kurz: "Schichten, Abwesenheiten und Besetzung zentral im Blick.",
    punkte: [
      "Anträge mit Blick auf die Besetzung entscheiden",
      "Krankmeldungen und Abwesenheiten eintragen",
      "Engpässe erkennen, bevor die Schicht beginnt",
    ],
  },
  {
    titel: "Mitarbeiter",
    kurz: "Eigene Schichten und Anträge einfach verwalten.",
    punkte: [
      "Eigene Schichten und den Plan der Gruppe sehen",
      "Urlaub direkt aus dem Plan beantragen",
      "Stand von Anträgen und Urlaubskonto jederzeit abrufbar",
      "Eigener Kalender mit Terminen, auf Wunsch mit dem Partner geteilt",
    ],
  },
];

const FUNKTIONSUEBERSICHT: { icon: ReactNode; text: string }[] = [
  { icon: <CalendarDays className="h-4 w-4" />, text: "Schichtplan mit Rotationsmustern" },
  { icon: <Layers className="h-4 w-4" />, text: "Schichtgruppen und frei definierbare Schichten" },
  { icon: <Users className="h-4 w-4" />, text: "Mitarbeiterverwaltung mit Rollen" },
  { icon: <Plane className="h-4 w-4" />, text: "Urlaubsanträge, Urlaubssperren, Urlaubskonten" },
  { icon: <ClipboardCheck className="h-4 w-4" />, text: "V-Tage, Altersfreizeit, Sonder- und Bildungsurlaub" },
  { icon: <MessageSquareWarning className="h-4 w-4" />, text: "Krankmeldungen und Abwesenheiten" },
  { icon: <ShieldCheck className="h-4 w-4" />, text: "Besetzungskontrolle: Mindest- und Sollbesetzung" },
  { icon: <BadgeCheck className="h-4 w-4" />, text: "Qualifikationen mit Mindestanzahl je Schicht" },
  { icon: <UserCog className="h-4 w-4" />, text: "Genehmigungen durch Schichtleitung und Administration" },
  { icon: <Bell className="h-4 w-4" />, text: "Benachrichtigungen und Mitteilungen in der Anwendung" },
  { icon: <Download className="h-4 w-4" />, text: "Export des Schichtplans als Tabellendatei (CSV)" },
  { icon: <CalendarDays className="h-4 w-4" />, text: "Feiertage nach Bundesland, Schulferien im Plan" },
  { icon: <CalendarHeart className="h-4 w-4" />, text: "Persönlicher Kalender mit Terminen, Partner per Link einladen" },
  { icon: <Smartphone className="h-4 w-4" />, text: "Auf dem Handy als App installierbar, mit Dunkelmodus" },
  { icon: <ShieldCheck className="h-4 w-4" />, text: "Datenschutz-Einstellungen je Mitarbeiter" },
  { icon: <LayoutGrid className="h-4 w-4" />, text: "Startseite frei wählbar: Übersicht oder eigener Kalender" },
  { icon: <LogOut className="h-4 w-4" />, text: "Automatische Abmeldung, abgestuft nach Rolle" },
  { icon: <UserCheck className="h-4 w-4" />, text: "Ohne KI und ohne Tracking – über Anträge entscheiden Menschen" },
];

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
    frage: "Für welche Unternehmen ist Schichtplan geeignet?",
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
      "Je Schicht werden eine Mindest- und eine Sollbesetzung festgelegt, zusätzlich auf Wunsch eine Mindestanzahl je Qualifikation. Schichtplan zeigt pro Tag, ob die Besetzung erfüllt ist, unter Soll liegt oder die Mindestbesetzung reißt, und prüft Urlaubsanträge vor der Genehmigung dagegen. Die Entscheidung trifft immer ein Mensch.",
  },
  {
    frage: "Wird künstliche Intelligenz eingesetzt?",
    antwort:
      "Nein. Schichtplan nutzt keine KI-Dienste und gibt keine Daten an KI-Anbieter weiter. Konten, Besetzung und Konflikte werden nach festen, nachvollziehbaren Regeln berechnet; über Anträge entscheidet immer ein Mensch.",
  },
  {
    frage: "Wo werden die Daten gespeichert?",
    antwort:
      "Die Daten liegen in einer Datenbank in der EU (Irland). Jedes Unternehmen hat einen eigenen Bereich; die Trennung wird in der Datenbank durchgesetzt. Einzelheiten stehen in der Datenschutzerklärung.",
  },
];

const HIGHLIGHTS: { icon: ReactNode; titel: string; text: string; bild: ReactNode }[] = [
  {
    icon: <Repeat className="h-5 w-5" />,
    titel: "Schichtfolge in 3 Sekunden",
    text: "Wähle deinen Rhythmus – etwa je zwei Früh, Spät, Nacht und dann frei – und trag ihn bis zum gewünschten Monat ein. Einzelne Tage änderst du danach mit einem Tipp, Urlaub und Krank gleich mit.",
    bild: <RotationBild />,
  },
  {
    icon: <Heart className="h-5 w-5" />,
    titel: "Partner-Ansicht",
    text: "Lade deinen Partner per Link ein – ganz ohne Konto. Ihr seht beide eure Schichten, Urlaub und Termine und wisst sofort, wann ihr zusammen frei habt.",
    bild: <PartnerBild />,
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    titel: "Im Kalender deines Handys",
    text: "Mit dem Kalender-Abo erscheinen deine Schichten im iPhone- oder Google-Kalender und als Widget auf dem Startbildschirm – ohne die App zu öffnen. Auf Wunsch jede Schicht in ihrer eigenen Farbe.",
    bild: <AboBild />,
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    titel: "Auswertung & Überstunden",
    text: "Wie viele Früh-, Spät- und Nachtschichten hattest du im Monat oder im Jahr? Trag deine Wochenstunden ein und sieh Soll, Ist und Überstunden auf einen Blick.",
    bild: <AuswertungBild />,
  },
];

/* ------------------------------------------------------------------ */

function Abschnitt({
  id,
  eyebrow,
  titel,
  intro,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  titel: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-16 sm:py-24 ${className ?? ""}`}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{titel}</h2>
          {intro ? <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{intro}</p> : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* 1. Hero: der kostenlose Schichtkalender */}
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
              Schichtfolge einmal eintragen – der ganze Kalender füllt sich von selbst. Mit Feiertagen,
              Urlaub, Terminen, Partner-Ansicht und direkt im Kalender deines Handys.
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
            {[
              "Nur Spitzname und Passwort",
              "In 30 Sekunden startklar",
              "Für iPhone, Android und PC",
              "Löschen jederzeit mit einem Klick",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-ok-fg" strokeWidth={2.5} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. Was den Kalender besonders macht */}
      <section className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Was ihn besonders macht</p>
            <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">
              Gemacht für Menschen, die in Schichten arbeiten.
            </h2>
          </div>
          <div className="mt-12 space-y-16 sm:space-y-24">
            {HIGHLIGHTS.map((h, i) => (
              <article key={h.titel} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={i % 2 ? "lg:order-2" : undefined}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{h.icon}</span>
                  <h3 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight sm:text-[30px]">{h.titel}</h3>
                  <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-ink-muted">{h.text}</p>
                </div>
                <div className={i % 2 ? "lg:order-1" : undefined}>{h.bild}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Los geht's */}
      <section className="px-4 sm:px-6">
        <div className="privat mx-auto w-full max-w-6xl overflow-hidden rounded-[28px] border border-line px-6 py-12 sm:px-12 sm:py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
                In 30 Sekunden startklar.
              </h2>
              <ol className="mt-6 space-y-3">
                {[
                  "Spitzname und Passwort wählen",
                  "Schichtfolge antippen – der Kalender füllt sich",
                  "Partner einladen oder ins Handy holen, wenn du magst",
                ].map((t, i) => (
                  <li key={t} className="flex items-center gap-3 text-[16px]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[14px] font-bold text-white">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <CtaLink href={ZIELE.privat} size="lg">
                Kostenlos starten
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Für Unternehmen */}
      <section id="unternehmen" className="relative mt-16 scroll-mt-16 overflow-hidden border-y border-line bg-surface-muted sm:mt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(to_right,rgb(var(--c-line))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--c-line))_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              Für Unternehmen
            </p>
            <h2 className="mt-5 text-[32px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">
              Schichtplanung, Urlaub und Besetzung.{" "}
              <span className="text-brand-600">In einem System.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-muted">{BESCHREIBUNG}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaLink href={ZIELE.testen} size="lg">
                Für den Betrieb testen
                <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
              <CtaLink href={ZIELE.demo} size="lg" variant="secondary">
                Live-Demo ansehen
              </CtaLink>
            </div>
          </div>
          <PlanPreview kompakt className="lg:translate-y-2" />
        </div>
      </section>

      {/* 2. Problem */}
      <Abschnitt
        eyebrow="Das Problem"
        titel="Schichtbetrieb ist komplex. Excel und Zurufe machen es nicht einfacher."
        intro="In vielen Betrieben ist die Schichtplanung über Dateien, Chats und Absprachen verteilt. Das kostet Zeit und führt zu Lücken, die erst in der Schicht auffallen."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEME.map((p) => (
            <li
              key={p}
              className="flex gap-3 rounded-card border border-line bg-surface p-5 text-[15px] leading-relaxed text-ink"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-crit-dot" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </Abschnitt>

      {/* 3. Kernfunktionen */}
      <Abschnitt
        id="funktionen"
        eyebrow="Kernfunktionen"
        titel="Alles, was die Schichtplanung braucht – an einem Ort."
        className="border-y border-line bg-surface-muted"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KERNFUNKTIONEN.map((f) => (
            <article key={f.titel} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {f.icon}
              </div>
              <h3 className="mt-4 text-[17px] font-semibold">{f.titel}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{f.text}</p>
            </article>
          ))}
        </div>
      </Abschnitt>

      {/* 4. USP Besetzung */}
      <section id="besetzung" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Besetzungskontrolle</p>
            <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">
              Verhindert Unterbesetzung, bevor sie zum Problem wird.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
              Für jede Schicht legen Sie eine Mindest- und eine Sollbesetzung fest – und auf Wunsch,
              wie viele Personen mit einer bestimmten Qualifikation mindestens da sein müssen.
              Schichtplan zeigt für jeden Tag, ob die Besetzung stimmt, und prüft Urlaubsanträge
              dagegen, bevor sie genehmigt werden.
            </p>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { farbe: "bg-ok-dot", term: "Grün", text: "Sollbesetzung erfüllt" },
                { farbe: "bg-warn-dot", term: "Gelb", text: "unter Soll, Mindestbesetzung hält" },
                { farbe: "bg-crit-dot", term: "Rot", text: "Mindestbesetzung reißt" },
              ].map((s) => (
                <div key={s.term} className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                  <dt className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.farbe}`} aria-hidden />
                    {s.term}
                  </dt>
                  <dd className="mt-1 text-[13px] leading-snug text-ink-muted">{s.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <StaffingPreview />
        </div>
      </section>

      {/* 5. Zielgruppen */}
      <Abschnitt
        id="fuer-wen"
        eyebrow="Für wen"
        titel="Gemacht für Betriebe, die rund um die Uhr laufen."
        intro="Schichtplan ist für Unternehmen mit Schichtbetrieb gedacht – unabhängig von der Branche."
        className="border-y border-line bg-surface-muted"
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ZIELGRUPPEN.map((z) => (
            <li key={z.titel} className="flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
                {z.icon}
              </span>
              <span className="text-[15px] font-medium">{z.titel}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      {/* 6. Vorteile nach Rolle */}
      <Abschnitt eyebrow="Für jede Rolle" titel="Jeder sieht, was er braucht.">
        <div className="grid gap-4 lg:grid-cols-3">
          {ROLLEN.map((r) => (
            <article key={r.titel} className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card">
              <h3 className="text-[17px] font-semibold">{r.titel}</h3>
              <p className="mt-2 text-[14px] text-ink-muted">{r.kurz}</p>
              <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
                {r.punkte.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[14px] leading-snug">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Abschnitt>

      {/* 7. Produkt-Vorschau */}
      <Abschnitt
        id="vorschau"
        eyebrow="Produkt-Vorschau"
        titel="So sieht Ihr Schichtplan aus."
        intro="Schichtgruppen, Schichten, Urlaub, Abwesenheiten und Besetzung in einer Ansicht – in denselben Farben wie in der Anwendung. Die Namen sind Beispieldaten."
        className="border-y border-line bg-surface-muted"
      >
        <PlanPreview />
      </Abschnitt>

      {/* 8. Funktionsübersicht */}
      <Abschnitt eyebrow="Funktionsübersicht" titel="Was heute schon drin ist.">
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {FUNKTIONSUEBERSICHT.map((f) => (
            <li key={f.text} className="flex items-start gap-3 text-[14px] leading-snug">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {f.icon}
              </span>
              <span className="pt-1">{f.text}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      {/* 9. Demo – feste Markenfarbe, damit weiße Schrift auch im Dunkelmodus lesbar bleibt. */}
      <section id="demo" className="scroll-mt-20 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[24px] bg-[rgb(33_72_204)] px-6 py-12 text-white sm:px-12 sm:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
                Schichtplan live ausprobieren
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85">
                Sie möchten Schichtplan nicht nur ansehen? Testen Sie die Anwendung direkt mit einer
                vorbereiteten Demo.
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

      {/* Preise */}
      <Abschnitt id="preise" eyebrow="Preise" titel="Kostenlos testen, Preise folgen.">
        <div className="max-w-2xl rounded-card border border-line bg-surface p-6 shadow-card">
          <p className="text-[15px] leading-relaxed text-ink">
            Die Preismodelle werden derzeit erarbeitet. Registrierung und Test sind aktuell kostenlos.
          </p>
          <div className="mt-5">
            <CtaLink href={ZIELE.testen}>Kostenlos testen</CtaLink>
          </div>
        </div>
      </Abschnitt>

      {/* 11. FAQ */}
      <Abschnitt
        id="faq"
        eyebrow="FAQ"
        titel="Häufige Fragen"
        className="border-y border-line bg-surface-muted"
      >
        <div className="mx-auto max-w-3xl divide-y divide-line rounded-card border border-line bg-surface">
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
      </Abschnitt>

      {/* Abschluss */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">
            Bereit? Leg los – kostenlos.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="privat flex flex-col rounded-[24px] border border-line p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Für dich</p>
              <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Dein Schichtkalender</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-muted">
                Schichten, Urlaub, Termine und Partner – auf dem Handy und im Handy-Kalender.
              </p>
              <div className="mt-6">
                <CtaLink href={ZIELE.privat} size="lg">
                  Kostenlos starten
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </CtaLink>
              </div>
            </div>
            <div className="flex flex-col rounded-[24px] border border-line bg-surface-muted p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Für deinen Betrieb</p>
              <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Schichtplanung für das Team</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-muted">
                Planen, Urlaub verwalten, Besetzung im Blick behalten.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <CtaLink href={ZIELE.testen} size="lg">
                  Kostenlos testen
                </CtaLink>
                <CtaLink href={ZIELE.demo} size="lg" variant="secondary">
                  Live-Demo
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
