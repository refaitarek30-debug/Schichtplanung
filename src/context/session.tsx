"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { company as demoCompany, demoAccounts, employees, getShift } from "@/lib/demo-data";
import type {
  Company,
  Employee,
  Role,
  SessionMode,
  SessionProfile,
  Shift,
} from "@/lib/types";

interface SessionValue {
  mode: SessionMode;
  /**
   * Rolle, mit der die Oberfläche angezeigt wird. Im Demo-Modus umschaltbar;
   * im Betrieb kann die Führung sich die App „als Mitarbeiter" ansehen.
   */
  role: Role;
  setRole: (role: Role) => void;
  /** Die tatsächliche Rolle aus der Datenbank – unabhängig von der Ansicht. */
  echteRolle: Role;
  /**
   * Nur Anzeige: welche Rolle die Oberfläche spielt. `null` = die eigene.
   * Rechte ändern sich dadurch nicht – die prüft allein die Datenbank.
   */
  ansicht: Role | null;
  setAnsicht: (rolle: Role | null) => void;
  /** Echte Identität aus `profiles` – Name, Rolle, Unternehmen. */
  profile: SessionProfile;
  company: Company;
  /**
   * Persona aus dem Demo-Datensatz, an der die Planungsansichten hängen.
   * Ab Phase 3 kommen Urlaubskonto und Schichten aus Supabase; dann fällt
   * dieses Feld weg.
   */
  user: Employee;
  shift: Shift | undefined;
}

const SessionContext = createContext<SessionValue | null>(null);

function demoProfile(person: Employee): SessionProfile {
  return {
    id: person.id,
    companyId: person.companyId,
    employeeId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    role: person.role,
    avatarUrl: null,
    active: person.active,
    personnelNumber: person.id.replace("e-", "1000"),
    department: "Produktion",
    shiftName: getShift(person.shiftId)?.name ?? null,
    // Im Demo-Modus gibt es kein Profil zum Speichern – dort stehen alle
    // Kacheln, damit man sieht, was die Anwendung kann.
    hiddenDashboardTiles: [],
  };
}

const RANG: Record<Role, number> = { employee: 0, shift_leader: 1, admin: 2 };

/** Ansehen darf man nur eine Rolle unterhalb der eigenen. */
function erlaubteAnsicht(echt: Role, ansicht: Role): boolean {
  return RANG[ansicht] < RANG[echt];
}

export function SessionProvider({
  mode,
  profile,
  company,
  children,
}: {
  mode: SessionMode;
  profile?: SessionProfile;
  company?: Company;
  children: ReactNode;
}) {
  const [demoRole, setDemoRole] = useState<Role>("employee");
  const [ansicht, setAnsichtState] = useState<Role | null>(null);
  const echteRolle: Role = mode === "live" && profile ? profile.role : demoRole;

  // Die gewählte Ansicht gilt für diesen Tab, bis man zurückschaltet oder
  // sich abmeldet. Nur eine Bequemlichkeit – ohne Speicher gilt die eigene.
  useEffect(() => {
    try {
      const gemerkt = window.sessionStorage.getItem("sp_ansicht") as Role | null;
      if (gemerkt && erlaubteAnsicht(echteRolle, gemerkt)) setAnsichtState(gemerkt);
    } catch {
      // kein Speicher: eigene Ansicht
    }
  }, [echteRolle]);

  function setAnsicht(rolle: Role | null) {
    const neu = rolle && rolle !== echteRolle && erlaubteAnsicht(echteRolle, rolle) ? rolle : null;
    setAnsichtState(neu);
    try {
      if (neu) window.sessionStorage.setItem("sp_ansicht", neu);
      else window.sessionStorage.removeItem("sp_ansicht");
    } catch {
      // egal
    }
  }

  const value = useMemo<SessionValue>(() => {
    const role =
      mode === "live" && ansicht && erlaubteAnsicht(echteRolle, ansicht) ? ansicht : echteRolle;
    const persona =
      employees.find((e) => e.id === demoAccounts[role]) ?? employees[0];

    return {
      mode,
      role,
      setRole: mode === "demo" ? setDemoRole : () => {},
      echteRolle,
      ansicht: role === echteRolle ? null : role,
      setAnsicht,
      profile: mode === "live" && profile ? profile : demoProfile(persona),
      company: mode === "live" && company ? company : demoCompany,
      user: persona,
      shift: getShift(persona.shiftId),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, company, demoRole, ansicht, echteRolle]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession muss innerhalb von SessionProvider stehen.");
  return context;
}
