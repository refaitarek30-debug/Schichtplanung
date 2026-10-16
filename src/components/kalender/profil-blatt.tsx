"use client";

import { PushAnstoss } from "./erinnerungen";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Cog, LayoutGrid, LogOut, UserRound } from "lucide-react";
import { KachelListe } from "@/components/dashboard/tile-settings";
import { useKachelAuswahl } from "@/lib/kachel-auswahl";
import { Blatt } from "@/components/privat/blatt";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/context/session";
import { signOut } from "@/lib/auth/actions";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type LiveNotification,
} from "@/lib/data/notifications";
import { vergissAenderungsstand, useAktualisierung } from "@/lib/live-refresh";
import { roleLabels } from "@/lib/nav";
import { forgetIdentity } from "@/lib/supabase/identity";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Profil im neuen Kalender: Auf dem Handy fehlt dort die Kopfleiste. Hier
 * steht alles, was sie bot – Benachrichtigungen, Profil, Einstellungen, die
 * Ansicht als andere Rolle und Abmelden.
 */

const ROLLEN: Role[] = ["employee", "shift_leader", "admin"];

function vor(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tg.`;
}

/** Ungelesene Benachrichtigungen – für den Punkt am Knopf und die Liste. */
export function useBenachrichtigungen() {
  const { mode, profile } = useSession();
  const employeeId = profile.employeeId;
  const [items, setItems] = useState<LiveNotification[] | null>(null);

  const laden = useCallback(async () => {
    if (mode !== "live") return;
    if (!employeeId) {
      setItems([]);
      return;
    }
    try {
      setItems(await fetchNotifications(employeeId));
    } catch {
      setItems((alt) => alt ?? []);
    }
  }, [mode, employeeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);
  useAktualisierung(["benachrichtigungen"], () => void laden());

  return { items, setItems };
}

export function ProfilBlatt({
  items,
  setItems,
  onClose,
}: {
  items: LiveNotification[] | null;
  setItems: React.Dispatch<React.SetStateAction<LiveNotification[] | null>>;
  onClose: () => void;
}) {
  const { role, profile, echteRolle, ansicht, setAnsicht } = useSession();
  const ansichten = ROLLEN.filter((r) => ROLLEN.indexOf(r) < ROLLEN.indexOf(echteRolle));
  const ungelesen = (items ?? []).filter((n) => !n.readAt).length;
  const kacheln = useKachelAuswahl();

  // Beim Öffnen die ungelesenen als gelesen markieren – wie die Glocke.
  // Die Hervorhebung bleibt, bis das Fenster zugeht.
  const [beimOeffnen] = useState(() => new Set((items ?? []).filter((n) => !n.readAt).map((n) => n.id)));
  useEffect(() => {
    const ids = [...beimOeffnen];
    if (!ids.length) return;
    markAllNotificationsRead(ids).catch(() => {});
    setItems((aktuell) => (aktuell ?? []).map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    // Nur einmal beim Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zeile =
    "flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.05] px-4 py-3.5 text-left text-[15.5px] font-medium active:bg-ink/[0.09]";

  return (
    <Blatt titel="Profil" onClose={onClose}>
      <div className="flex items-center gap-3 pb-4">
        <Avatar employee={profile} className="h-12 w-12 text-[15px]" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="truncate text-[13px] text-ink-muted">{roleLabels[role]}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/profil" onClick={onClose} className={zeile}>
          <UserRound className="h-5 w-5 text-ink-muted" strokeWidth={1.8} /> Mein Profil
        </Link>
        <Link href="/einstellungen" onClick={onClose} className={zeile}>
          <Cog className="h-5 w-5 text-ink-muted" strokeWidth={1.8} /> Einstellungen
        </Link>
      </div>

      {kacheln ? (
        <>
          <p className="mb-1.5 mt-5 flex items-center gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
            <LayoutGrid className="h-3.5 w-3.5" /> Kacheln auf dem Start
          </p>
          <div className="rounded-[16px] bg-ink/[0.04] p-1.5">
            <KachelListe {...kacheln} blatt />
          </div>
        </>
      ) : null}

      <p className="mb-1.5 mt-5 flex items-center gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        <Bell className="h-3.5 w-3.5" /> Benachrichtigungen
        {ungelesen > 0 ? <span className="rounded-full bg-crit-dot px-1.5 text-[10.5px] text-white">{ungelesen}</span> : null}
      </p>
      <PushAnstoss className="mb-2" />
      <div className="max-h-64 overflow-y-auto rounded-[16px] bg-ink/[0.04]">
        {items === null ? (
          <p className="px-4 py-5 text-center text-[14px] text-ink-muted">wird geladen …</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-5 text-center text-[14px] text-ink-muted">Noch keine Benachrichtigungen.</p>
        ) : (
          items.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.readAt) {
                  markNotificationRead(n.id).catch(() => {});
                  setItems((a) => (a ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
                }
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left",
                i > 0 && "glas-linie border-t",
                beimOeffnen.has(n.id) && "bg-brand-500/10",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[14px] font-medium">{n.title}</span>
                <span className="shrink-0 text-[11.5px] text-ink-faint">{vor(n.createdAt)}</span>
              </span>
              <span className="text-[13px] leading-snug text-ink-muted">{n.body}</span>
            </button>
          ))
        )}
      </div>

      {ansichten.length > 0 ? (
        <>
          <p className="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Ansicht</p>
          <div className="space-y-1.5">
            {[echteRolle, ...ansichten].map((wert) => {
              const aktiv = (ansicht ?? echteRolle) === wert;
              return (
                <button
                  key={wert}
                  type="button"
                  onClick={() => {
                    setAnsicht(wert === echteRolle ? null : wert);
                    onClose();
                  }}
                  aria-pressed={aktiv}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left text-[15px]",
                    aktiv ? "bg-brand-500/15 font-semibold text-brand-700" : "bg-ink/[0.05]",
                  )}
                >
                  {wert === echteRolle ? `${roleLabels[wert]} (meine Rolle)` : `Als ${roleLabels[wert]} ansehen`}
                  {aktiv ? <span className="text-[12px]">aktiv</span> : null}
                </button>
              );
            })}
            <p className="px-1 text-[12px] text-ink-faint">Nur die Anzeige wechselt – deine Rechte bleiben gleich.</p>
          </div>
        </>
      ) : null}

      <form
        action={signOut}
        // Wie im Profilmenü der Kopfleiste: alles Zwischengespeicherte verwerfen.
        onSubmit={() => {
          setAnsicht(null);
          leereZwischenspeicher();
          forgetIdentity();
          vergissAenderungsstand();
        }}
        className="mt-5"
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-ink/[0.05] py-3.5 text-[15.5px] font-semibold text-crit-fg active:bg-ink/[0.09]"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.8} /> Abmelden
        </button>
      </form>
    </Blatt>
  );
}
