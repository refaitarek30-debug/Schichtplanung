"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  /** Rolle der angemeldeten Person. Im Demo-Modus umschaltbar. */
  role: Role;
  setRole: (role: Role) => void;
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
  };
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

  const value = useMemo<SessionValue>(() => {
    const role = mode === "live" && profile ? profile.role : demoRole;
    const persona =
      employees.find((e) => e.id === demoAccounts[role]) ?? employees[0];

    return {
      mode,
      role,
      setRole: mode === "demo" ? setDemoRole : () => {},
      profile: mode === "live" && profile ? profile : demoProfile(persona),
      company: mode === "live" && company ? company : demoCompany,
      user: persona,
      shift: getShift(persona.shiftId),
    };
  }, [mode, profile, company, demoRole]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession muss innerhalb von SessionProvider stehen.");
  return context;
}
