"use client";

import Link from "next/link";
import { ChevronDown, Eye, LogOut, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/context/session";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { roleLabels } from "@/lib/nav";
import { signOut } from "@/lib/auth/actions";
import { vergissAenderungsstand } from "@/lib/live-refresh";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const roles: Role[] = ["employee", "shift_leader", "admin"];

export function Topbar() {
  const { mode, role, setRole, profile, company, shift, echteRolle, ansicht, setAnsicht } =
    useSession();
  const ansichten = roles.filter((r) => r !== echteRolle && roles.indexOf(r) < roles.indexOf(echteRolle));
  const [open, setOpen] = useState(false);
  const wurzel = useRef<HTMLDivElement>(null);

  /**
   * Das Menü schließt von selbst: nach einem Klick daneben, mit Escape und
   * spätestens nach zehn Sekunden.
   *
   * Auf dem Handy bleibt ein offenes Menü sonst über der Ansicht stehen,
   * wenn man daneben tippt und der Tipp auf einem Element landet, das ihn
   * schluckt. Die Zeitgrenze ist der letzte Ausweg, kein Ersatz für die
   * beiden anderen Wege.
   */
  useEffect(() => {
    if (!open) return;
    function beiKlick(e: MouseEvent) {
      if (!wurzel.current?.contains(e.target as Node)) setOpen(false);
    }
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const uhr = window.setTimeout(() => setOpen(false), 10_000);
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      window.clearTimeout(uhr);
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <div className="lg:hidden">
        <p className="text-sm font-semibold tracking-tight">Schichtplan</p>
        <p className="truncate text-[11px] text-ink-faint">{company.name}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Deutlich sichtbar, solange man die App in einer anderen Rolle
            ansieht – und mit einem Tipp wieder zurück. */}
        {ansicht ? (
          <button
            type="button"
            onClick={() => setAnsicht(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1.5 text-[12px] font-semibold text-warn-fg ring-1 ring-warn-dot/40"
            title="Zurück zur eigenen Ansicht"
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Ansicht:</span> {roleLabels[ansicht]}
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        ) : null}
        <NotificationBell />

        <div className="relative" ref={wurzel}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl border border-line py-1.5 pl-1.5 pr-2.5 hover:bg-surface-muted"
            aria-expanded={open}
            // Auf dem Handy ist vom Knopf nur das Bild und der Pfeil zu
            // sehen – ohne Beschriftung hätte ihn eine Vorlesehilfe nur
            // als „Schaltfläche" angesagt.
            aria-label="Profilmenü"
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
                <>
                {ansichten.length > 0 ? (
                  <div className="mt-1 border-t border-line pt-1">
                    <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Ansicht
                    </p>
                    {[echteRolle, ...ansichten].map((value) => {
                      const aktiv = (ansicht ?? echteRolle) === value;
                      return (
                        <button
                          key={value}
                          onClick={() => {
                            setAnsicht(value === echteRolle ? null : value);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm",
                            aktiv
                              ? "bg-brand-50 font-medium text-brand-700"
                              : "text-ink-muted hover:bg-surface-muted",
                          )}
                        >
                          {value === echteRolle
                            ? `${roleLabels[value]} (meine Rolle)`
                            : `Als ${roleLabels[value]} ansehen`}
                          {aktiv ? <span className="text-xs">aktiv</span> : null}
                        </button>
                      );
                    })}
                    <p className="px-2.5 pb-1 text-[11px] leading-snug text-ink-faint">
                      Nur die Anzeige wechselt – deine Rechte bleiben gleich.
                    </p>
                  </div>
                ) : null}
                <form
                  action={signOut}
                  // Die Abmeldung endet mit einer weichen Umleitung – der
                  // Arbeitsspeicher des Tabs bleibt dabei bestehen. Deshalb
                  // hier ausdrücklich alles Zwischengespeicherte verwerfen.
                  onSubmit={() => {
                    setAnsicht(null);
                    leereZwischenspeicher();
                    vergissAenderungsstand();
                  }}
                  className="border-t border-line pt-1"
                >
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-ink-muted hover:bg-surface-muted"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    Abmelden
                  </button>
                </form>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
