"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/context/session";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { roleLabels } from "@/lib/nav";
import { signOut } from "@/lib/auth/actions";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const roles: Role[] = ["employee", "shift_leader", "admin"];

export function Topbar() {
  const { mode, role, setRole, profile, company, shift } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <div className="lg:hidden">
        <p className="text-sm font-semibold tracking-tight">Schichtplan</p>
        <p className="truncate text-[11px] text-ink-faint">{company.name}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl border border-line py-1.5 pl-1.5 pr-2.5 hover:bg-surface-muted"
            aria-expanded={open}
          >
            <Avatar employee={profile} className="h-8 w-8" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-medium">
                {profile.firstName} {profile.lastName}
              </span>
              <span className="block text-[11px] text-ink-faint">
                {roleLabels[role]}
                {profile.shiftName ?? (shift && shift.code !== "FREI" ? shift.name : "")
                  ? ` · ${profile.shiftName ?? shift?.name}`
                  : ""}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-ink-faint" />
          </button>

          {open ? (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-pop">
              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-muted"
              >
                <UserRound className="h-4 w-4" strokeWidth={1.8} />
                Mein Profil
              </Link>

              {mode === "demo" ? (
                <>
                  <p className="mt-1 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                    Demo-Rolle wechseln
                  </p>
                  {roles.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setRole(value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm",
                        role === value
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-ink-muted hover:bg-surface-muted",
                      )}
                    >
                      {roleLabels[value]}
                      {role === value ? <span className="text-xs">aktiv</span> : null}
                    </button>
                  ))}
                  <p className="border-t border-line px-2.5 pt-2 text-[11px] leading-snug text-ink-faint">
                    Sobald Supabase konfiguriert ist, kommt die Rolle aus der Datenbank.
                  </p>
                </>
              ) : (
                <form action={signOut} className="border-t border-line pt-1">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-muted"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    Abmelden
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
