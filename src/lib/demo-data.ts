/**
 * Demo-Datensatz für die Entwicklungsumgebung.
 * Wird in Phase 2 vollständig durch Supabase-Queries ersetzt – die Signaturen
 * der Selektoren am Ende dieser Datei bleiben dabei erhalten.
 */
import { toISO } from "./dates";
import type {
  Absence,
  Announcement,
  Company,
  Employee,
  Holiday,
  LeaveRequest,
  Role,
  Shift,
} from "./types";

export const TODAY = toISO(new Date());

export const company: Company = {
  id: "co-1",
  name: "Muster Produktion GmbH",
  region: "NW",
};

export const shifts: Shift[] = [
  {
    id: "sh-frueh",
    companyId: "co-1",
    name: "Frühschicht",
    code: "FRUEH",
    startTime: "06:00",
    endTime: "14:00",
    targetHeadcount: 7,
    minHeadcount: 6,
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    id: "sh-spaet",
    companyId: "co-1",
    name: "Spätschicht",
    code: "SPAET",
    startTime: "14:00",
    endTime: "22:00",
    targetHeadcount: 5,
    minHeadcount: 4,
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    id: "sh-nacht",
    companyId: "co-1",
    name: "Nachtschicht",
    code: "NACHT",
    startTime: "22:00",
    endTime: "06:00",
    targetHeadcount: 4,
    minHeadcount: 3,
    weekdays: [0, 1, 2, 3, 4],
  },
  {
    id: "sh-tag",
    companyId: "co-1",
    name: "Tagdienst",
    code: "FREI",
    startTime: "08:00",
    endTime: "16:30",
    targetHeadcount: 0,
    minHeadcount: 0,
    weekdays: [1, 2, 3, 4, 5],
  },
];

const employee = (
  id: string,
  firstName: string,
  lastName: string,
  shiftId: string,
  jobTitle: string,
  role: Role = "employee",
  entryDate = "2019-04-01",
  carryOver = 0,
): Employee => ({
  id,
  companyId: "co-1",
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@muster-produktion.de`,
  role,
  shiftId,
  jobTitle,
  entitlement: 30,
  carryOver,
  active: true,
  entryDate,
});

export const employees: Employee[] = [
  // Frühschicht – 8 zugeordnete Personen bei Soll 7 / Mindest 6
  employee("e-01", "Marco", "Feldkamp", "sh-frueh", "Schichtführer", "shift_leader", "2012-09-01", 3),
  employee("e-02", "Tarek", "Refai", "sh-frueh", "Anlagenfahrer", "employee", "2018-03-01"),
  employee("e-03", "Sabine", "Kraushaar", "sh-frueh", "Chemikantin"),
  employee("e-04", "Dennis", "Oltmann", "sh-frueh", "Anlagenfahrer", "employee", "2021-08-16"),
  employee("e-05", "Ilona", "Petzold", "sh-frueh", "Chemikantin", "employee", "2015-01-05", 2),
  employee("e-06", "Ahmet", "Yildirim", "sh-frueh", "Anlagenfahrer"),
  employee("e-07", "Nadine", "Brehm", "sh-frueh", "Laborantin", "employee", "2022-02-01"),
  employee("e-08", "Jonas", "Wieland", "sh-frueh", "Anlagenfahrer", "employee", "2023-06-01"),

  // Spätschicht – 5 Personen bei Soll 5 / Mindest 4
  employee("e-09", "Katrin", "Sallmann", "sh-spaet", "Schichtführerin", "shift_leader", "2014-05-02"),
  employee("e-10", "Ruben", "Achterberg", "sh-spaet", "Anlagenfahrer"),
  employee("e-11", "Melanie", "Hoss", "sh-spaet", "Chemikantin", "employee", "2020-10-01"),
  employee("e-12", "Piotr", "Wisniewski", "sh-spaet", "Anlagenfahrer"),
  employee("e-13", "Elias", "Grunert", "sh-spaet", "Chemikant", "employee", "2024-01-08"),

  // Nachtschicht – 4 Personen bei Soll 4 / Mindest 3
  employee("e-14", "Halil", "Dogan", "sh-nacht", "Schichtführer", "shift_leader", "2013-03-01"),
  employee("e-15", "Frank", "Ostermann", "sh-nacht", "Anlagenfahrer", "employee", "2011-07-01", 4),
  employee("e-16", "Yvonne", "Radke", "sh-nacht", "Chemikantin"),
  employee("e-17", "Sven", "Lorbeer", "sh-nacht", "Anlagenfahrer", "employee", "2022-09-01"),

  // Tagdienst
  employee("e-18", "Andrea", "Kuypers", "sh-tag", "Personalleitung", "admin", "2010-02-01"),
];

export const leaveRequests: LeaveRequest[] = [
  {
    id: "lr-01",
    employeeId: "e-02",
    startDate: "2026-02-09",
    endDate: "2026-02-13",
    halfDay: false,
    days: 5,
    status: "approved",
    createdAt: "2026-01-12",
    decidedBy: "e-01",
    decidedAt: "2026-01-14",
  },
  {
    id: "lr-02",
    employeeId: "e-02",
    startDate: "2026-08-03",
    endDate: "2026-08-05",
    halfDay: false,
    days: 3,
    status: "approved",
    createdAt: "2026-06-30",
    decidedBy: "e-01",
    decidedAt: "2026-07-02",
  },
  {
    id: "lr-03",
    employeeId: "e-02",
    startDate: "2026-12-21",
    endDate: "2026-12-24",
    halfDay: false,
    days: 4,
    comment: "Weihnachten mit der Familie",
    status: "approved",
    createdAt: "2026-05-04",
    decidedBy: "e-01",
    decidedAt: "2026-05-06",
  },
  {
    id: "lr-04",
    employeeId: "e-02",
    startDate: "2026-09-14",
    endDate: "2026-09-18",
    halfDay: false,
    days: 5,
    comment: "Kurzurlaub",
    status: "pending",
    createdAt: "2026-08-24",
  },
  {
    id: "lr-05",
    employeeId: "e-02",
    startDate: "2026-10-05",
    endDate: "2026-10-06",
    halfDay: false,
    days: 2,
    status: "pending",
    createdAt: "2026-08-28",
  },
  {
    id: "lr-06",
    employeeId: "e-05",
    startDate: "2026-08-24",
    endDate: "2026-09-04",
    halfDay: false,
    days: 10,
    status: "approved",
    createdAt: "2026-05-18",
    decidedBy: "e-01",
    decidedAt: "2026-05-19",
  },
  {
    id: "lr-07",
    employeeId: "e-08",
    startDate: "2026-09-03",
    endDate: "2026-09-11",
    halfDay: false,
    days: 7,
    status: "approved",
    createdAt: "2026-07-01",
    decidedBy: "e-01",
    decidedAt: "2026-07-03",
  },
  {
    id: "lr-08",
    employeeId: "e-04",
    startDate: "2026-09-07",
    endDate: "2026-09-11",
    halfDay: false,
    days: 5,
    comment: "Umzug",
    status: "pending",
    createdAt: "2026-08-26",
  },
  {
    id: "lr-09",
    employeeId: "e-11",
    startDate: "2026-09-21",
    endDate: "2026-09-25",
    halfDay: false,
    days: 5,
    status: "pending",
    createdAt: "2026-08-27",
  },
  {
    id: "lr-10",
    employeeId: "e-03",
    startDate: "2026-10-19",
    endDate: "2026-10-23",
    halfDay: false,
    days: 5,
    status: "approved",
    createdAt: "2026-06-11",
    decidedBy: "e-01",
    decidedAt: "2026-06-12",
  },
  {
    id: "lr-11",
    employeeId: "e-16",
    startDate: "2026-09-14",
    endDate: "2026-09-18",
    halfDay: false,
    days: 5,
    status: "approved",
    createdAt: "2026-04-20",
    decidedBy: "e-14",
    decidedAt: "2026-04-21",
  },
  {
    id: "lr-12",
    employeeId: "e-06",
    startDate: "2026-09-16",
    endDate: "2026-09-18",
    halfDay: false,
    days: 3,
    status: "approved",
    createdAt: "2026-07-22",
    decidedBy: "e-01",
    decidedAt: "2026-07-23",
  },
  {
    id: "lr-13",
    employeeId: "e-10",
    startDate: "2026-08-31",
    endDate: "2026-09-02",
    halfDay: false,
    days: 3,
    status: "approved",
    createdAt: "2026-07-30",
    decidedBy: "e-09",
    decidedAt: "2026-07-31",
  },
  {
    id: "lr-14",
    employeeId: "e-12",
    startDate: "2026-07-06",
    endDate: "2026-07-17",
    halfDay: false,
    days: 10,
    status: "approved",
    createdAt: "2026-03-02",
    decidedBy: "e-09",
    decidedAt: "2026-03-03",
  },
  {
    id: "lr-15",
    employeeId: "e-07",
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    halfDay: false,
    days: 5,
    status: "rejected",
    createdAt: "2026-08-10",
    decidedBy: "e-01",
    decidedAt: "2026-08-12",
    decisionNote: "Mindestbesetzung der Frühschicht nicht darstellbar.",
  },
];

export const absences: Absence[] = [
  { id: "ab-01", employeeId: "e-07", date: "2026-09-02", type: "krank" },
  { id: "ab-02", employeeId: "e-07", date: "2026-09-03", type: "krank" },
  { id: "ab-03", employeeId: "e-13", date: "2026-08-31", type: "krank" },
  { id: "ab-04", employeeId: "e-15", date: "2026-09-07", type: "schulung", note: "Gefahrgut-Auffrischung" },
  { id: "ab-05", employeeId: "e-17", date: "2026-09-08", type: "krank" },
  { id: "ab-06", employeeId: "e-03", date: "2026-09-22", type: "schulung" },
];

/** Gesetzliche Feiertage Nordrhein-Westfalen 2026. */
export const holidays: Holiday[] = [
  { date: "2026-01-01", name: "Neujahr", region: "NW" },
  { date: "2026-04-03", name: "Karfreitag", region: "NW" },
  { date: "2026-04-06", name: "Ostermontag", region: "NW" },
  { date: "2026-05-01", name: "Tag der Arbeit", region: "NW" },
  { date: "2026-05-14", name: "Christi Himmelfahrt", region: "NW" },
  { date: "2026-05-25", name: "Pfingstmontag", region: "NW" },
  { date: "2026-06-04", name: "Fronleichnam", region: "NW" },
  { date: "2026-10-03", name: "Tag der Deutschen Einheit", region: "NW" },
  { date: "2026-11-01", name: "Allerheiligen", region: "NW" },
  { date: "2026-12-25", name: "1. Weihnachtstag", region: "NW" },
  { date: "2026-12-26", name: "2. Weihnachtstag", region: "NW" },
];

export const announcements: Announcement[] = [
  {
    id: "an-01",
    title: "Betriebsferien 2027 geplant",
    body: "Vom 27.12.2027 bis 31.12.2027 ruht die Produktion. Die Tage werden automatisch vom Urlaubskonto abgezogen.",
    createdAt: "2026-08-25",
    level: "info",
  },
  {
    id: "an-02",
    title: "Spätschicht in KW 36 knapp besetzt",
    body: "Bitte Urlaubsanträge für die Spätschicht in dieser Woche vorab mit der Schichtführung abstimmen.",
    createdAt: "2026-08-28",
    level: "warn",
  },
];

/** Demo-Logins: pro Rolle ein Konto, umschaltbar über die Kopfzeile. */
export const demoAccounts: Record<Role, string> = {
  employee: "e-02",
  shift_leader: "e-01",
  admin: "e-18",
};

// --- Selektoren (später Supabase-Queries) -----------------------------------

export const getEmployee = (id: string) => employees.find((e) => e.id === id);

export const getShift = (id: string) => shifts.find((s) => s.id === id);

export const employeesOfShift = (shiftId: string) =>
  employees.filter((e) => e.active && e.shiftId === shiftId);

export const requestsOfEmployee = (employeeId: string) =>
  leaveRequests
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

export const pendingRequestsForShift = (shiftId: string) =>
  leaveRequests
    .filter(
      (r) =>
        r.status === "pending" &&
        employees.some((e) => e.id === r.employeeId && e.shiftId === shiftId),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

export const allPendingRequests = () =>
  leaveRequests
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

export const staffingContext = {
  employees,
  shifts,
  absences,
  leaveRequests,
  holidays,
};
