import {
  CalendarDays,
  ClipboardCheck,
  Cog,
  Layers,
  LayoutDashboard,
  Palmtree,
  Scale,
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
    href: "/kalender",
    label: "Kalender",
    short: "Kalender",
    icon: CalendarDays,
    roles: ["employee", "shift_leader", "admin"],
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
    href: "/mitarbeiter",
    label: "Mitarbeiter",
    icon: Users,
    roles: ["shift_leader", "admin"],
  },
  {
    href: "/schichten",
    label: "Schichten",
    icon: Layers,
    roles: ["admin"],
  },
  {
    href: "/regeln",
    label: "Regeln",
    icon: Scale,
    roles: ["admin"],
  },
  {
    href: "/einstellungen",
    label: "Einstellungen",
    icon: Cog,
    roles: ["admin"],
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
