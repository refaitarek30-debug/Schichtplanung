/**
 * Inhalte der Startseite (Privat und Betrieb) – auch für die eigene
 * Betriebsseite unter /betriebe.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Cake,
  CalendarDays,
  CalendarRange,
  EyeOff,
  FileDown,
  Gauge,
  GraduationCap,
  Lock,
  KeyRound,
  ListChecks,
  Palette,
  Plane,
  Repeat,
  Server,
  ShieldCheck,
  Smartphone,
  Thermometer,
  Trash2,
  UserCog,
  Users,
  Wallet,
  Check,
  Info,
  FileCheck2,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { CtaLink, ZIELE } from "@/components/marketing/cta";
import { WischShow, type Folie } from "@/components/marketing/wisch-show";
import { PAKETE, PILOT_RABATT_MONATE, PILOT_RABATT_PROZENT, Preise } from "@/components/marketing/preise";
import {
  BetriebAntrag,
  BetriebBesetzung,
  BetriebGenehmigen,
  BetriebKalender,
  BetriebKonten,
  PcBetrieb,
  PcPrivat,
  PrivatAbo,
  PrivatAuswertung,
  PrivatFolge,
  PrivatImport,
  PrivatMonat,
  PrivatPartner,
  PrivatTag,
} from "@/components/marketing/bildschirme";

/* ------------------------------------------------------------------ */
/* Inhalte – nur Funktionen, die es in der Anwendung gibt.             */
/* ------------------------------------------------------------------ */

type Ton = "blau" | "gruen" | "orange" | "lila" | "rosa" | "tuerkis" | "gelb";
type Punkt = { icon: ReactNode; titel: string; text: string; ton?: Ton };

/** Farbe der Symbolfläche je Karte – hell im Hintergrund, kräftig im Symbol. */
const TOENE: Record<Ton, string> = {
  blau: "bg-[#e6efff] text-[#2563eb] dark:bg-[#1e3a8a]/40 dark:text-[#93b4ff]",
  gruen: "bg-[#e3f6ea] text-[#16a34a] dark:bg-[#14532d]/40 dark:text-[#86efac]",
  orange: "bg-[#fff0e0] text-[#ea7a0c] dark:bg-[#7c2d12]/40 dark:text-[#fdba74]",
  lila: "bg-[#f1eafe] text-[#7c3aed] dark:bg-[#4c1d95]/40 dark:text-[#c4b5fd]",
  rosa: "bg-[#fde8f0] text-[#db2777] dark:bg-[#831843]/40 dark:text-[#f9a8d4]",
  tuerkis: "bg-[#e0f5f4] text-[#0d9488] dark:bg-[#134e4a]/40 dark:text-[#5eead4]",
  gelb: "bg-[#fdf5d8] text-[#ca8a04] dark:bg-[#713f12]/40 dark:text-[#fde047]",
};
const i = "h-[22px] w-[22px]";

const FOLIEN_PRIVAT: Folie[] = [
  { titel: "Dein Monat", text: "Jede Schicht in ihrer Farbe. Heute ist rot markiert.", bild: <PrivatMonat /> },
  { titel: "Schichtfolge", text: "Einmal eintippen – das ganze Jahr ist gefüllt.", bild: <PrivatFolge /> },
  { titel: "Dein Tag", text: "Termine, Erinnerungen, Geburtstage und To-dos.", bild: <PrivatTag /> },
  { titel: "Teilen", text: "Partner und Familie sehen deine Schichten.", bild: <PrivatPartner /> },
  { titel: "Im Handy-Kalender", text: "Als Abo im iPhone- oder Google-Kalender, auch als Widget.", bild: <PrivatAbo /> },
  { titel: "Auswertung", text: "Schichten zählen, Stunden und Überstunden.", bild: <PrivatAuswertung /> },
  { titel: "Umziehen", text: "Schichten aus einer anderen App übernehmen – per Datei oder Screenshot.", bild: <PrivatImport /> },
];

const FOLIEN_BETRIEB: Folie[] = [
  { titel: "Mein Kalender", text: "Jeder sieht seine Schichten – und bekommt Bescheid, wenn sich etwas ändert.", bild: <BetriebKalender /> },
  { titel: "Urlaub beantragen", text: "Direkt vom Handy, mit Resttagen und Besetzungsprüfung.", bild: <BetriebAntrag /> },
  { titel: "Genehmigen", text: "Die Schichtleitung sieht sofort, was ein Antrag für die Besetzung bedeutet.", bild: <BetriebGenehmigen /> },
  { titel: "Besetzung", text: "Grün, gelb, rot – Lücken fallen auf, bevor die Schicht beginnt.", bild: <BetriebBesetzung /> },
  { titel: "Konten", text: "Urlaub, V-Tage und Altersfreizeit laufen automatisch mit.", bild: <BetriebKonten /> },
];

const FUNKTIONEN_PRIVAT: Punkt[] = [
  { icon: <Repeat className={i} />, ton: "blau", titel: "Schichtfolge", text: "Einmal eintragen, das ganze Jahr ist gefüllt. Einzelne Tage änderst du mit einem Tipp." },
  { icon: <CalendarDays className={i} />, ton: "gruen", titel: "Ansichten", text: "Woche, Monat und Jahr – mit den Feiertagen deines Bundeslands." },
  { icon: <Palette className={i} />, ton: "lila", titel: "Deine Schichten", text: "Namen, Uhrzeiten und Farben, wie du sie brauchst. Auf einen Blick sehen, was kommt." },
  { icon: <Bell className={i} />, ton: "orange", titel: "Termine", text: "Mit Wiederholung und Erinnerung aufs Handy." },
  { icon: <ListChecks className={i} />, ton: "gruen", titel: "To-dos", text: "Kleine Aufgaben direkt am Tag." },
  { icon: <Cake className={i} />, ton: "rosa", titel: "Geburtstage", text: "Mit Alter und Erinnerung – nie wieder einen wichtigen Tag vergessen." },
  { icon: <Users className={i} />, ton: "lila", titel: "Partner und Familie", text: "Gegenseitig Schichten sehen und gemeinsame freie Tage finden." },
  { icon: <RefreshCw className={i} />, ton: "blau", titel: "Im Handy-Kalender", text: "Als Abo im iPhone- oder Google-Kalender und als Widget." },
  { icon: <BarChart3 className={i} />, ton: "tuerkis", titel: "Auswertung", text: "Schichten zählen, Soll und Ist, Überstunden." },
];

const AUSSERDEM_PRIVAT = ["Umziehen aus einer anderen App – per Datei oder Screenshot", "Handy und PC, auf dem Startbildschirm wie eine App", "Hell oder dunkel"];

const FUNKTIONEN_BETRIEB: Punkt[] = [
  { icon: <CalendarRange className={i} />, ton: "blau", titel: "Schichtplan", text: "Woche und Monat für alle Gruppen auf einen Blick – auch zum Ausdrucken." },
  { icon: <Repeat className={i} />, ton: "lila", titel: "Rotation A bis E", text: "Muster einmal festlegen, der Plan füllt sich." },
  { icon: <Gauge className={i} />, ton: "gruen", titel: "Besetzung", text: "Mindest- und Sollbesetzung je Schicht, mit Ampel für jeden Tag." },
  { icon: <BadgeCheck className={i} />, ton: "tuerkis", titel: "Qualifikationen", text: "Mindestanzahl je Schicht, jeden Tag geprüft." },
  { icon: <Plane className={i} />, ton: "orange", titel: "Urlaub digital", text: "Beantragen und genehmigen – mit Blick auf die Besetzung." },
  { icon: <Wallet className={i} />, ton: "gelb", titel: "Konten", text: "Urlaub, V-Tage und Altersfreizeit laufen automatisch mit." },
  { icon: <Thermometer className={i} />, ton: "rosa", titel: "Krank und Abwesenheiten", text: "Eintragen und sofort sehen, wo es eng wird." },
  { icon: <Bell className={i} />, ton: "orange", titel: "Mitteilungen", text: "Benachrichtigung aufs Handy, wenn sich etwas ändert." },
  { icon: <Smartphone className={i} />, ton: "blau", titel: "Mein Kalender", text: "Für jeden im Team, auch im Kalender des Handys." },
  { icon: <UserCog className={i} />, ton: "lila", titel: "Rollen und Rechte", text: "Leitung, Schichtleitung und Mitarbeiter sehen, was sie brauchen." },
  { icon: <GraduationCap className={i} />, ton: "gruen", titel: "Ausbildung", text: "Auszubildende im Plan mitführen – mit Kachel „Nächste Berufsschule“." },
  { icon: <BarChart3 className={i} />, ton: "tuerkis", titel: "Auswertung", text: "Ausfall und Anwesenheit für Monat und Jahr." },
];

const AUSSERDEM_BETRIEB = ["Plan als Datei oder PDF weitergeben", "Änderungsprotokoll: wer hat wann was geändert", "Automatische Abmeldung je nach Rolle"];

const ROLLEN = [
  {
    name: "Betriebsleitung",
    satz: "Regeln festlegen, Überblick behalten.",
    punkte: ["Schichten, Gruppen und Mindestbesetzung", "Konten und Urlaubssperren", "Mitarbeiter einladen, Rollen vergeben"],
  },
  {
    name: "Schichtleitung",
    satz: "Entscheiden mit Blick auf die Besetzung.",
    punkte: ["Anträge genehmigen oder ablehnen", "Krank und Abwesenheiten eintragen", "Engpässe vor Schichtbeginn sehen"],
  },
  {
    name: "Mitarbeiter",
    satz: "Eigene Schichten, alles auf dem Handy.",
    punkte: ["Urlaub direkt beantragen", "Konten und Antragsstand jederzeit", "Kalender mit Partner teilen"],
  },
];

const SICHER_PRIVAT: Punkt[] = [
  { icon: <Server className={i} />, titel: "Server in der EU", text: "Deine Daten liegen in einer Datenbank in Irland." },
  { icon: <Lock className={i} />, titel: "Verschlüsselt übertragen", text: "Jede Verbindung läuft über HTTPS." },
  { icon: <EyeOff className={i} />, titel: "Ohne KI, Werbung und Tracking", text: "Keine Weitergabe an KI-Anbieter, keine Werbe- oder Analysedienste." },
  { icon: <Users className={i} />, titel: "Nur wen du einlädst", text: "Deine Schichten sieht nur, wem du sie freigibst." },
  { icon: <Smartphone className={i} />, titel: "Ohne E-Mail möglich", text: "Spitzname und Passwort genügen." },
  { icon: <Trash2 className={i} />, titel: "Löschen jederzeit", text: "Dein Konto mit allen Einträgen, selbst und sofort. Vorher alles als Datei sichern." },
];

const SICHER_BETRIEB: Punkt[] = [
  { icon: <Server className={i} />, titel: "Server in der EU", text: "Die Daten liegen in einer Datenbank in Irland." },
  { icon: <KeyRound className={i} />, titel: "Zwei-Faktor-Anmeldung", text: "Pflicht für Leitung und Administration. Nach 5 Fehlversuchen wird der Zugang gesperrt." },
  { icon: <Users className={i} />, titel: "Getrennte Bereiche", text: "Jeder Betrieb hat einen eigenen Bereich; die Trennung setzt die Datenbank selbst durch." },
  { icon: <ShieldCheck className={i} />, titel: "Keine Leistungskontrolle", text: "Keine Auswertung je Person, keine Lesebestätigung. Krankheit ist standardmäßig privat." },
  { icon: <EyeOff className={i} />, titel: "Ohne KI, Werbung und Tracking", text: "Keine Weitergabe an KI-Anbieter. Über Anträge entscheidet immer ein Mensch." },
  { icon: <FileDown className={i} />, titel: "AV-Vertrag und Datenkopie", text: "AV-Vertrag mit TOMs. Jede Person lädt ihre Daten selbst als Datei herunter." },
];

/** Kurz und knapp: die Zeile unter „Deine Daten gehören dir.“ */
const SICHER_KURZ_PRIVAT = [
  { icon: <MapPin className={i} />, text: "Server in der EU (Irland)" },
  { icon: <Lock className={i} />, text: "Verschlüsselt (HTTPS)" },
  { icon: <EyeOff className={i} />, text: "Keine KI, keine Werbung, kein Tracking" },
  { icon: <FileCheck2 className={i} />, text: "Nach DSGVO gebaut" },
  { icon: <ShieldCheck className={i} />, text: "Entwickelt in Deutschland" },
];
const SICHER_KURZ_BETRIEB = [
  { icon: <MapPin className={i} />, text: "Server in der EU (Irland)" },
  { icon: <KeyRound className={i} />, text: "Zwei-Faktor-Anmeldung" },
  { icon: <EyeOff className={i} />, text: "Keine KI, keine Werbung, kein Tracking" },
  { icon: <FileCheck2 className={i} />, text: "AV-Vertrag nach DSGVO" },
  { icon: <ShieldCheck className={i} />, text: "Entwickelt in Deutschland" },
];

type Frage = { frage: string; antwort: ReactNode };

const FRAGEN_PRIVAT: Frage[] = [
  {
    frage: "Was kostet der Schichtkalender?",
    antwort: "Nichts – ohne Abo und ohne Werbung. Das bleibt so: Geld verdient ShiftNexo mit der Schichtplanung für Betriebe.",
  },
  {
    frage: "Brauche ich eine E-Mail-Adresse?",
    antwort:
      "Nein. Zum Anlegen reichen ein Spitzname und ein Passwort. Eine E-Mail-Adresse kannst du freiwillig hinterlegen, damit du ein vergessenes Passwort zurücksetzen kannst.",
  },
  {
    frage: "Funktioniert der Kalender auf iPhone und Android?",
    antwort:
      "Ja. Er läuft im Browser und lässt sich auf dem Handy wie eine App auf den Startbildschirm legen. Über das Kalender-Abo erscheinen deine Schichten zusätzlich im Kalender deines Handys – auch als Widget. Neue Einträge holt der Handy-Kalender selbst ab; das kann einige Stunden dauern.",
  },
  {
    frage: "Kann ich meine Schichten aus einer anderen App übernehmen?",
    antwort:
      "Ja. Unter „Übernehmen“ wählst du eine Kalenderdatei aus deiner bisherigen App oder Screenshots deiner Monate. Screenshots werden direkt auf deinem Gerät gelesen. Du siehst alles, bevor es übernommen wird, und kannst es mit einem Tipp rückgängig machen.",
  },
  {
    frage: "Wer sieht meine Schichten?",
    antwort:
      "Nur du – und die Personen, die du selbst einlädst, etwa deinen Partner oder deine Familie. Eine Freigabe nimmst du jederzeit zurück.",
  },
  {
    frage: "Wie lange bleibe ich angemeldet?",
    antwort:
      "Auf deinem Gerät bleibst du angemeldet, solange du den Kalender mindestens alle 30 Tage öffnest. Der Kalender öffnet sich sofort mit dem zuletzt gesehenen Stand.",
  },
  {
    frage: "Kann ich mein Konto löschen?",
    antwort: "Ja, jederzeit selbst unter „Mehr“ – mit allen Einträgen, ohne Nachfrage bei uns.",
  },
  {
    frage: "Wird künstliche Intelligenz eingesetzt?",
    antwort: "Nein. ShiftNexo nutzt keine KI-Dienste und gibt keine Daten an KI-Anbieter weiter.",
  },
];

const FRAGEN_BETRIEB: Frage[] = [
  {
    frage: "Was kostet ShiftNexo für einen Betrieb?",
    antwort: (
      <>
        Alle Funktionen sind für alle Betriebe dabei. Ihr zahlt nur nach der Größe des Teams: ab {PAKETE[0]!.preis} € netto im Monat (bis{" "}
        {PAKETE[0]!.bis} Personen), zum Beispiel {PAKETE.find((p) => p.bis === 30)?.preis} € für bis zu 30 Personen. Die Übersicht steht oben unter{" "}
        <a href="#preise" className="font-medium text-brand-600 hover:underline">
          Preise
        </a>
        . In der dreimonatigen Pilotphase ist der volle Umfang kostenlos, danach gibt es für Pilotbetriebe {PILOT_RABATT_MONATE} Monate lang{" "}
        {PILOT_RABATT_PROZENT} % Rabatt.
      </>
    ),
  },
  {
    frage: "Für welche Betriebe ist ShiftNexo geeignet?",
    antwort:
      "Für Betriebe mit festen Schichtmodellen – etwa Produktion, Chemie- und Kunststoffindustrie, Maschinen- und Anlagenbau oder Logistik. Entscheidend ist, dass in Schichten gearbeitet wird und Urlaub, Abwesenheiten und Besetzung zusammen geplant werden müssen.",
  },
  {
    frage: "Welche Schichtsysteme werden unterstützt?",
    antwort:
      "Schichten legt ihr selbst an – mit Name, Kürzel, Uhrzeiten, Wochentagen sowie Mindest- und Sollbesetzung. Rotierende Gruppen werden über Rotationsmuster abgebildet; möglich sind bis zu fünf Gruppen (A bis E). Damit lassen sich 2-, 3-, 4- und 5-Schicht-Modelle planen.",
  },
  {
    frage: "Wie funktioniert die Besetzungskontrolle?",
    antwort:
      "Je Schicht legt ihr eine Mindest- und eine Sollbesetzung fest, auf Wunsch auch eine Mindestanzahl je Qualifikation. ShiftNexo zeigt pro Tag, ob die Besetzung erfüllt ist, unter Soll liegt oder die Mindestbesetzung reißt, und prüft Urlaubsanträge vor der Genehmigung dagegen. Die Entscheidung trifft immer ein Mensch.",
  },
  {
    frage: "Was sehen die Mitarbeiter?",
    antwort:
      "Jeder bekommt einen eigenen Zugang per Einladung und sieht seine Schichten, den Schichtplan, seine Konten und Anträge. Gründe für Abwesenheiten von Kollegen sind standardmäßig verborgen und lassen sich je Person freigeben. Im eigenen Kalender können Mitarbeiter private Termine eintragen und ihn mit Partner oder Familie teilen.",
  },
  {
    frage: "Wie kommen unsere Mitarbeiter hinein?",
    antwort:
      "Ihr legt die Mitarbeiter an und schickt ihnen eine Einladung. Ein Datei-Import ist derzeit nicht vorhanden; ein Einrichtungsassistent führt nach der Registrierung durch die ersten Schritte. Auf Wunsch übernehmen wir die Einrichtung.",
  },
  {
    frage: "Gibt es eine Demo?",
    antwort:
      "Ja. Unter „Live-Demo“ bekommt ihr ohne Anmeldung einen eigenen Demo-Betrieb mit Beispieldaten und offenen Anträgen. Er wird nach 24 Stunden automatisch gelöscht.",
  },
  {
    frage: "Wo liegen die Daten, und gibt es einen AV-Vertrag?",
    antwort: (
      <>
        Die Daten liegen in einer Datenbank in der EU (Irland). Jeder Betrieb hat einen eigenen, in der Datenbank abgetrennten Bereich;
        Leitung und Administration melden sich mit Zwei-Faktor-Code an. Technische und organisatorische Maßnahmen,
        Löschkonzept und eine Vorlage für die Datenschutz-Folgenabschätzung schicken wir euch gern. Den{" "}
        <Link href="/avv" className="font-medium text-brand-600 hover:underline">
          Vertrag zur Auftragsverarbeitung
        </Link>{" "}
        und die{" "}
        <Link href="/datenschutz" className="font-medium text-brand-600 hover:underline">
          Datenschutzerklärung
        </Link>{" "}
        findet ihr hier.
      </>
    ),
  },
  {
    frage: "Wird künstliche Intelligenz eingesetzt?",
    antwort:
      "Nein. Konten, Besetzung und Konflikte werden nach festen, nachvollziehbaren Regeln berechnet; über Anträge entscheidet immer ein Mensch.",
  },
];

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

function Abschnitt({ id, children, className }: { id?: string; grau?: boolean; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 py-20 sm:py-28 ${className ?? ""}`}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

function Ueberschrift({ titel, text }: { titel: ReactNode; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.025em] text-[#0f1d3d] dark:text-ink sm:text-[52px]">{titel}</h2>
      {text ? <p className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">{text}</p> : null}
    </div>
  );
}

/** Kleine Zeile über der Überschrift: Punkte mit Trennern. */
function Hinweise({ teile }: { teile: string[] }) {
  return (
    <>
      {teile.map((t, n) => (
        <span key={t} className="flex items-center gap-2.5">
          {n > 0 ? <span aria-hidden className="h-1 w-1 rounded-full bg-ink-faint" /> : null}
          {t}
        </span>
      ))}
    </>
  );
}

function Held({
  id,
  hinweis,
  titel,
  zweite,
  text,
  knoepfe,
  show,
}: {
  id: string;
  hinweis: ReactNode;
  titel: string;
  zweite: string;
  text: ReactNode;
  knoepfe: ReactNode;
  show: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 overflow-x-clip pb-16 pt-10 sm:pb-24 sm:pt-16">
      <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13.5px] font-medium text-ink-muted sm:text-[15px]">{hinweis}</div>
        <h1 className="mx-auto mt-4 max-w-4xl text-balance text-[44px] font-bold leading-[1.02] tracking-[-0.035em] text-[#0f1d3d] dark:text-ink sm:text-[68px] lg:text-[80px]">
          {titel}
          <span className="block">{zweite}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-ink-muted sm:text-[20px]">{text}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{knoepfe}</div>
        <div className="mt-12 sm:mt-16">{show}</div>
      </div>
    </section>
  );
}

function Karten({ punkte, ausserdem }: { punkte: Punkt[]; ausserdem?: string[] }) {
  return (
    <>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {punkte.map((p) => (
          <li key={p.titel} className="glas flex flex-col items-center rounded-[24px] px-6 pb-7 pt-7 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] [&_svg]:h-7 [&_svg]:w-7 ${TOENE[p.ton ?? "blau"]}`} aria-hidden>
              {p.icon}
            </span>
            <h3 className="mt-4 text-balance text-[19px] font-bold tracking-tight">{p.titel}</h3>
            <p className="mt-1.5 text-pretty text-[15px] leading-relaxed text-ink-muted">{p.text}</p>
          </li>
        ))}
      </ul>
      {ausserdem?.length ? (
        <p className="mx-auto mt-8 max-w-3xl text-balance text-center text-[15px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">Außerdem: </span>
          {ausserdem.join(" · ")}
        </p>
      ) : null}
    </>
  );
}

/** Ausführliche Liste (z. B. Sicherheit im Detail). */
function Liste({ punkte }: { punkte: Punkt[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {punkte.map((p) => (
        <li key={p.titel} className="flex gap-4 text-left">
          <span className="mt-0.5 shrink-0 text-brand-600" aria-hidden>
            {p.icon}
          </span>
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">{p.titel}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{p.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Fragen({ id, fragen, titel }: { id: string; fragen: Frage[]; titel: string }) {
  return (
    <Abschnitt id={id} grau>
      <Ueberschrift titel={titel} />
      <div className="glas mx-auto mt-12 max-w-3xl divide-y divide-[var(--glas-linie)] overflow-hidden rounded-[28px]">
        {fragen.map((f) => (
          <details key={f.frage} className="group px-5 sm:px-7">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-semibold tracking-tight sm:text-[17px] [&::-webkit-details-marker]:hidden">
              <h3>{f.frage}</h3>
              <span aria-hidden className="text-[22px] font-light leading-none text-ink-muted transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="-mt-1 pb-5 text-[15px] leading-relaxed text-ink-muted">{f.antwort}</p>
          </details>
        ))}
      </div>
    </Abschnitt>
  );
}

function Sicherheit({
  id,
  punkte,
  kurz,
  titel,
  unten,
  ihr = false,
}: {
  id: string;
  punkte: Punkt[];
  kurz: { icon: ReactNode; text: string }[];
  titel: string;
  unten?: ReactNode;
  /** „du“ (Privat) oder „ihr“ (Betrieb). */
  ihr?: boolean;
}) {
  return (
    <Abschnitt id={id}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.025em] text-[#0f1d3d] dark:text-ink sm:text-[52px]">{titel}</h2>
        <div className="mx-auto mt-5 flex w-44 items-center gap-2" aria-hidden>
          <span className="h-px flex-1 bg-brand-500/30" />
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          <span className="h-px flex-1 bg-brand-500/30" />
        </div>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">
          {ihr
            ? "Datenschutz ist bei uns keine Fußnote – damit ihr euch ganz auf eure Schichtplanung konzentrieren könnt."
            : "Datenschutz ist bei uns keine Fußnote – damit du dich ganz auf deine Schichten konzentrieren kannst."}
        </p>
      </div>
      <ul className="glas mx-auto mt-12 grid max-w-5xl grid-cols-2 overflow-hidden rounded-[28px] sm:grid-cols-3 lg:grid-cols-5" data-sicher-kurz>
        {kurz.map((k, n) => (
          <li
            key={k.text}
            className={`flex flex-col items-center gap-3 px-4 py-7 text-center ${n > 0 ? "lg:border-l lg:border-[var(--glas-linie)]" : ""} ${n === kurz.length - 1 && kurz.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <span className="text-brand-600 [&_svg]:h-9 [&_svg]:w-9 [&_svg]:stroke-[1.4]" aria-hidden>
              {k.icon}
            </span>
            <span className="text-balance text-[15px] font-medium leading-snug">{k.text}</span>
          </li>
        ))}
      </ul>
      {unten ? <div className="mt-8 flex justify-center">{unten}</div> : null}
      <details className="group mx-auto mt-10 max-w-5xl">
        <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-full px-4 py-2 text-[15px] font-medium text-brand-600 hover:bg-brand-500/10 [&::-webkit-details-marker]:hidden">
          Alles zur Sicherheit im Detail
          <span aria-hidden className="text-[20px] font-light leading-none transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="mt-8">
          <Liste punkte={punkte} />
        </div>
      </details>
      <p className="mt-8 text-center">
        <Link href="/datenschutz" className="text-[15px] font-medium text-brand-600 hover:underline">
          Zur Datenschutzerklärung
        </Link>
      </p>
    </Abschnitt>
  );
}

function Schluss({ titel, knoepfe }: { titel: string; knoepfe: ReactNode }) {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[56px]">{titel}</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{knoepfe}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pilotphase für Betriebe                                             */
/* ------------------------------------------------------------------ */

const PILOT_SCHRITTE = [
  { titel: "Registrieren", text: "Fünf kurze Fragen, eine Minute. Ihr bekommt einen eigenen, getrennten Bereich." },
  { titel: "Einrichten", text: "Ein Assistent führt durch Feiertage, Schichtsystem und Mitarbeiter. Auf Wunsch helfen wir dabei." },
  { titel: "Testen", text: "Am besten mit einer Schichtgruppe, parallel zum bisherigen Plan. Nichts muss sofort umgestellt werden." },
  { titel: "Entscheiden", text: "Nach drei Monaten gemeinsam auswerten: weitermachen, anpassen oder beenden. Ohne Verpflichtung." },
];

const PILOT_ENTHALTEN = [
  "Voller Funktionsumfang, ohne Begrenzung der Personen",
  "Drei Monate, keine Zahlungsdaten, keine Vertragslaufzeit",
  "Hilfe bei der Einrichtung, wenn ihr wollt",
  "Eure Wünsche fließen direkt in die Entwicklung ein",
];

const PILOT_OFFEN = [
  "Rotierende Gruppen: bis zu fünf (A bis E).",
  "Mitarbeiter werden einzeln angelegt; einen Datei-Import gibt es noch nicht.",
  "Gibt es bei euch einen Betriebsrat, sollte er vor dem Echtbetrieb eingebunden werden. Wir stellen die App gern vor.",
];

function Pilot() {
  return (
    <Abschnitt id="pilot">
      <Ueberschrift
        titel={
          <>
            Die Pilotphase.
            <span className="block text-ink-faint">Drei Monate kostenlos.</span>
          </>
        }
        text="Testet ShiftNexo drei Monate im echten Betrieb, bevor ihr euch festlegt. Die Pilotphase endet von selbst – ohne Kündigung und ohne Kosten."
      />
      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILOT_SCHRITTE.map((p, n) => (
          <li key={p.titel} className="glas rounded-[24px] p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white">
              {n + 1}
            </span>
            <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{p.titel}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{p.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glas rounded-[24px] p-6 sm:p-7">
          <h3 className="text-[18px] font-semibold tracking-tight">Was die Pilotphase enthält</h3>
          <ul className="mt-4 space-y-3">
            {PILOT_ENTHALTEN.map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-snug">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ok-dot" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="glas rounded-[24px] p-6 sm:p-7">
          <h3 className="text-[18px] font-semibold tracking-tight">Gut zu wissen</h3>
          <ul className="mt-4 space-y-3">
            {PILOT_OFFEN.map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-snug text-ink-muted">
                <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-faint" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <CtaLink href={ZIELE.testen} size="lg">
          Pilot starten
        </CtaLink>
        <CtaLink href={ZIELE.demo} size="lg" variant="secondary">
          Erst die Live-Demo ansehen
        </CtaLink>
      </div>
      <p className="mt-6 text-center text-[15px] text-ink-muted">
        Fragen vorab? Schreibt an{" "}
        <a href="mailto:shiftfornexo@gmail.com" className="font-medium text-brand-600 hover:underline">
          shiftfornexo@gmail.com
        </a>
      </p>
    </Abschnitt>
  );
}

/* ------------------------------------------------------------------ */
/* Die zwei Hälften                                                    */
/* ------------------------------------------------------------------ */

export function PrivatSeite() {
  return (
    <>
      <Held
        id="kalender"
        hinweis={<Hinweise teile={["Kostenlos", "Ohne Werbung", "Ohne E-Mail"]} />}
        titel="Dein Dienstplan."
        zweite="Einfach. Privat."
        text={
          <>
            Schichtfolge einmal eintragen – der Kalender füllt sich von selbst.{" "}
            <span className="sm:block">Auf dem Handy, am PC und im Kalender deines Handys.</span>
          </>
        }
        knoepfe={
          <>
            <CtaLink href={ZIELE.privat} size="lg">
              Kostenlos starten
            </CtaLink>
            <CtaLink href={ZIELE.anmelden} size="lg" variant="secondary">
              Anmelden
            </CtaLink>
          </>
        }
        show={<WischShow name="Schichtkalender" pc={<PcPrivat />} folien={FOLIEN_PRIVAT} />}
      />

      <Abschnitt id="funktionen-privat" grau>
        <Ueberschrift titel="Alles, was du brauchst." text="Gemacht für Schichtarbeit – nicht für Büro-Termine." />
        <Karten punkte={FUNKTIONEN_PRIVAT} ausserdem={AUSSERDEM_PRIVAT} />
      </Abschnitt>

      <Abschnitt>
        <Ueberschrift titel="In 30 Sekunden startklar." />
        <ol className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ["Konto anlegen", "Spitzname und Passwort – mehr nicht."],
            ["Schichtfolge eintippen", "Oder aus deiner bisherigen App übernehmen."],
            ["Aufs Handy legen", "Zum Startbildschirm hinzufügen, fertig."],
          ].map(([t, x], n) => (
            <li key={t} className="glas rounded-[24px] p-6">
              <span className="tnum text-[15px] font-semibold text-brand-600">{n + 1}</span>
              <p className="mt-2 text-[19px] font-semibold tracking-tight">{t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{x}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex justify-center">
          <CtaLink href={ZIELE.privat} size="lg">
            Kostenlos starten
          </CtaLink>
        </div>
      </Abschnitt>

      <Sicherheit id="sicherheit-privat" punkte={SICHER_PRIVAT} kurz={SICHER_KURZ_PRIVAT} titel="Deine Daten gehören dir." />
      <Fragen id="faq-privat" fragen={FRAGEN_PRIVAT} titel="Fragen zum Schichtkalender" />
      <Schluss
        titel="Probier es aus. Es kostet nichts."
        knoepfe={
          <>
            <CtaLink href={ZIELE.privat} size="lg">
              Kostenlos starten
            </CtaLink>
            <CtaLink href="/#betrieb" size="lg" variant="secondary">
              Für Betriebe
            </CtaLink>
          </>
        }
      />
    </>
  );
}

export function BetriebSeite() {
  return (
    <>
      <Held
        id="unternehmen"
        hinweis={<Hinweise teile={["Für Schichtbetriebe", "3 Monate kostenlos testen", "Server in der EU"]} />}
        titel="Der ganze Betrieb."
        zweite="Ein Plan."
        text={
          <>
            Schichtplan, Urlaub und Besetzung an einem Ort.{" "}
            <span className="sm:block">Am PC planen – auf dem Handy für jeden im Team.</span>
          </>
        }
        knoepfe={
          <>
            <CtaLink href={ZIELE.testen} size="lg">
              Pilot kostenlos starten
            </CtaLink>
            <CtaLink href={ZIELE.demo} size="lg" variant="secondary">
              Live-Demo ansehen
            </CtaLink>
          </>
        }
        show={<WischShow name="Schichtplanung" pc={<PcBetrieb />} folien={FOLIEN_BETRIEB} />}
      />

      <Pilot />

      <Abschnitt id="funktionen-betrieb" grau>
        <Ueberschrift titel="Alles für den Schichtbetrieb." text="Vom Rotationsmuster bis zum Urlaubskonto – ohne Tabellen und Zettel." />
        <Karten punkte={FUNKTIONEN_BETRIEB} ausserdem={AUSSERDEM_BETRIEB} />
      </Abschnitt>

      <Abschnitt id="rollen">
        <Ueberschrift titel="Jeder sieht, was er braucht." />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {ROLLEN.map((r) => (
            <div key={r.name} className="glas rounded-[28px] p-7">
              <p className="text-[14px] font-semibold text-brand-600">{r.name}</p>
              <p className="mt-2 text-[21px] font-semibold leading-snug tracking-tight">{r.satz}</p>
              <ul className="mt-5 space-y-2.5">
                {r.punkte.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink-muted">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt id="preise" grau>
        <Ueberschrift titel="Preise, die man versteht." text="Alle Funktionen für alle. Ihr zahlt nur nach der Größe eures Teams." />
        <div className="mx-auto mt-12 max-w-5xl">
          <Preise />
        </div>
      </Abschnitt>

      <Sicherheit
        id="sicherheit-betrieb"
        punkte={SICHER_BETRIEB}
        kurz={SICHER_KURZ_BETRIEB}
        titel="Eure Daten gehören euch."
        ihr
        unten={
          <a href="#pilot" className="glas inline-flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-[15px]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-600" aria-hidden>
              <Users className="h-[18px] w-[18px]" />
            </span>
            Pilotphase: drei Monate kostenlos im echten Betrieb testen
          </a>
        }
      />
      <Fragen id="faq-betrieb" fragen={FRAGEN_BETRIEB} titel="Fragen von Betrieben" />
      <Schluss
        titel="In 10 Sekunden im eigenen Demo-Betrieb."
        knoepfe={
          <>
            <CtaLink href={ZIELE.demo} size="lg">
              Live-Demo starten
            </CtaLink>
            <CtaLink href={ZIELE.testen} size="lg" variant="secondary">
              Betrieb registrieren
            </CtaLink>
          </>
        }
      />
    </>
  );
}

