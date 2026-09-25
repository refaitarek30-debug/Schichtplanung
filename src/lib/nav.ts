import {
  CakeSlice,
  CalendarDays,
  ClipboardCheck,
  Cog,
  Layers,
  BarChart3,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Palmtree,
  Timer,
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
    href: "/meine-schichten",
    label: "Meine Schichten",
    short: "Schichten",
    icon: Timer,
    roles: ["employee", "shift_leader", "admin"],
    primary: true,
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

export function navForRole(role: Role) {
  const visible = navItems.filter((item) => item.roles.includes(role));
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
