import {
  CakeSlice,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Cog,
  Layers,
  ListChecks,
  BarChart3,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Palmtree,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Kurzlabel für die mobile Tab-Leiste. */
  short?: string;
  primary?: boolean;
  /** Nur mit ausdrücklicher Freischaltung sichtbar (SessionProfile.protokoll). */
  nurProtokoll?: boolean;
  /** Kleines „Neu“, bis die Seite einmal geöffnet wurde (Name der Neuerung). */
  neu?: string;
  /** Rote Zahl am Eintrag: offene To-dos bis heute. */
  todoZahl?: boolean;
}

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "Start",
    icon: LayoutDashboard,
    roles: ["employee", "shift_leader", "admin"],
    primary: true,
  },
  {
    href: "/schichtplan",
    label: "Schichtplan",
    short: "Plan",
    icon: CalendarDays,
    roles: ["employee", "shift_leader", "admin"],
    primary: true,
  },
  {
    href: "/urlaub",
    label: "Urlaub",
    short: "Urlaub",
    icon: Palmtree,
    roles: ["employee", "shift_leader", "admin"],
    primary: true,
  },
  {
    // Der eigene Schichtplan als Monatskalender. Die Adresse ist die alte
    // von „Meine Schichten“ – Lesezeichen und die installierte App zeigen
    // dorthin. Die Teamübersicht von damals steht unter Verwaltung.
    href: "/meine-schichten",
    label: "Mein Kalender",
    short: "Kalender",
    icon: CalendarRange,
    neu: "kalender-partner",
    roles: ["employee", "shift_leader", "admin"],
    primary: true,
  },
  {
    // Wie im Privatbereich: eigene Liste mit Filtern, Suche und Erinnerung.
    // Nicht in der Leiste unten – im Kalender steht der Zähler oben. Die
    // To-dos sieht nur die Person selbst.
    href: "/todos",
    label: "To-dos",
    icon: ListChecks,
    todoZahl: true,
    roles: ["employee", "shift_leader", "admin"],
  },
  {
    href: "/besetzung",
    label: "Besetzung",
    icon: Layers,
    roles: ["shift_leader", "admin"],
  },
  {
    href: "/urlaubsantraege",
    label: "Urlaubsanträge",
    icon: ClipboardCheck,
    roles: ["shift_leader", "admin"],
  },
  {
    href: "/ausbildung",
    label: "Ausbildung",
    icon: GraduationCap,
    roles: ["shift_leader", "admin"],
  },
  {
    // Nur Administration: die Auswertung zeigt Kranktage je Person. Die
    // Schichtleitung plant damit nicht, deshalb steht ihr die Zahl auch
    // nicht zu. Abgesichert wird das in `absence_report()`, nicht hier --
    // diese Liste blendet nur aus.
    href: "/auswertung",
    label: "Auswertung",
    icon: BarChart3,
    roles: ["admin"],
  },
  {
    // Anmeldungen, Änderungen und Fehler. Nur für freigeschaltete Personen
    // – abgesichert in `protokoll_liste()`, hier wird nur ausgeblendet.
    href: "/protokoll",
    label: "Protokoll",
    icon: ScrollText,
    roles: ["admin"],
    nurProtokoll: true,
  },
  {
    // AF-Stundenstand eintragen – Administration und Schichtleitung. Das
    // Geburtsdatum korrigiert dort nur die Administration (set_birth_date).
    href: "/altersfreizeit",
    label: "AF-Stunden & V-Tage",
    icon: CakeSlice,
    roles: ["shift_leader", "admin"],
  },
  {
    // Mitteilungen und Urlaubssperren. Lagen vorher unter Verwaltung →
    // Regeln; beides geht an die ganze Belegschaft und gehört ins
    // Tagesgeschäft, nicht zu den Einstellungen, die man einmal setzt.
    href: "/mitteilungen",
    label: "Mitteilungen",
    icon: Megaphone,
    roles: ["shift_leader", "admin"],
  },
  {
    // Mitarbeiter, Schichten und Regeln – drei Reiter auf einer Seite.
    // Die Schichtleitung sieht dort nur die Mitarbeiter, deshalb steht der
    // Eintrag auch für sie in der Navigation.
    href: "/verwaltung",
    label: "Verwaltung",
    icon: Users,
    roles: ["shift_leader", "admin"],
  },
  {
    href: "/einstellungen",
    label: "Einstellungen",
    icon: Cog,
    roles: ["employee", "shift_leader", "admin"],
  },
];

export const navGroups: { label: string; roles: Role[] }[] = [
  { label: "Meine Ansicht", roles: ["employee", "shift_leader", "admin"] },
  { label: "Führung", roles: ["shift_leader", "admin"] },
  { label: "Verwaltung", roles: ["admin"] },
];

export function navForRole(role: Role, protokoll = false) {
  const visible = navItems.filter(
    (item) => item.roles.includes(role) && (!item.nurProtokoll || protokoll),
  );
  return [
    {
      label: "Meine Ansicht",
      items: visible.filter((i) => i.roles.includes("employee")),
    },
    {
      label: "Führung",
      items: visible.filter(
        (i) => !i.roles.includes("employee") && i.roles.includes("shift_leader"),
      ),
    },
    {
      label: "Verwaltung",
      items: visible.filter(
        (i) => !i.roles.includes("employee") && !i.roles.includes("shift_leader"),
      ),
    },
  ].filter((group) => group.items.length > 0);
}

export const roleLabels: Record<Role, string> = {
  employee: "Mitarbeiter",
  shift_leader: "Schichtleitung",
  admin: "Administration",
};

/**
 * Seitenleiste am Computer: wenige Bereiche, unter jedem steht klein, was
 * drinsteckt. Die einzelnen Seiten bleiben dieselben – Plan, Urlaub und
 * Team fassen nur mehrere Seiten zusammen (die Reiter stehen auf den Seiten).
 * Wer was sieht, bleibt wie bisher: dieselben Rollen wie in `navItems`.
 */
export interface LeistenEintrag {
  href: string;
  label: string;
  /** Kleiner Text unter dem Namen – was drinsteckt. */
  unter: string;
  icon: LucideIcon;
  roles: Role[];
  /** Auf diesen Seiten ist der Eintrag ebenfalls hervorgehoben. */
  auch?: string[];
  nurProtokoll?: boolean;
  neu?: string;
  todoZahl?: boolean;
  /** Rote Zahl: offene Urlaubsanträge zum Entscheiden (nur Führung). */
  offeneAntraege?: boolean;
}

const FUEHRUNG: Role[] = ["shift_leader", "admin"];
const ALLE: Role[] = ["employee", "shift_leader", "admin"];

const LEISTE: { label: string | null; eintraege: LeistenEintrag[] }[] = [
  {
    label: null,
    eintraege: [
      { href: "/dashboard", label: "Start", unter: "Übersicht · Meine Woche", icon: LayoutDashboard, roles: ALLE },
      {
        href: "/schichtplan",
        label: "Plan",
        unter: "Schichtplan · Besetzung · Ausbildung",
        icon: CalendarDays,
        roles: FUEHRUNG,
        auch: ["/besetzung", "/ausbildung"],
      },
      { href: "/schichtplan", label: "Schichtplan", unter: "Alle Schichten · Urlaub beantragen", icon: CalendarDays, roles: ["employee"] },
      {
        href: "/urlaub",
        label: "Urlaub",
        unter: "Mein Urlaub · Entscheiden",
        icon: Palmtree,
        roles: FUEHRUNG,
        auch: ["/urlaubsantraege"],
        offeneAntraege: true,
      },
      { href: "/urlaub", label: "Urlaub", unter: "Urlaubskonto · Meine Anträge", icon: Palmtree, roles: ["employee"] },
      {
        href: "/meine-schichten",
        label: "Kalender",
        unter: "Mein Monat · To-dos",
        icon: CalendarRange,
        roles: ALLE,
        auch: ["/todos"],
        neu: "kalender-partner",
        todoZahl: true,
      },
    ],
  },
  {
    label: "Führung",
    eintraege: [
      {
        href: "/verwaltung",
        label: "Team",
        unter: "Mitarbeiter · Gruppen · AF & V-Tage",
        icon: Users,
        roles: FUEHRUNG,
        auch: ["/altersfreizeit"],
      },
      {
        href: "/mitteilungen",
        label: "Mitteilungen",
        unter: "An Personen · An alle · Sperren",
        icon: Megaphone,
        roles: FUEHRUNG,
      },
    ],
  },
  {
    label: "Nur Administration",
    eintraege: [
      { href: "/auswertung", label: "Auswertung", unter: "Ausfall · Anwesenheit · Gesundheitsrate", icon: BarChart3, roles: ["admin"] },
      { href: "/protokoll", label: "Protokoll", unter: "Anmeldungen · Änderungen · Fehler", icon: ScrollText, roles: ["admin"], nurProtokoll: true },
    ],
  },
  {
    label: null,
    eintraege: [{ href: "/einstellungen", label: "Einstellungen", unter: "Profil · Darstellung · Datenschutz", icon: Cog, roles: ALLE }],
  },
];

export function leisteFuerRolle(role: Role, protokoll = false) {
  return LEISTE.map((g) => ({
    label: g.label,
    eintraege: g.eintraege.filter((e) => e.roles.includes(role) && (!e.nurProtokoll || protokoll)),
  })).filter((g) => g.eintraege.length > 0);
}

/** Ist der Eintrag auf dieser Seite hervorgehoben? */
export function leisteAktiv(e: LeistenEintrag, pathname: string): boolean {
  return pathname === e.href || (e.auch ?? []).includes(pathname);
}
