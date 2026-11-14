"use client";

import { PushAnstoss } from "./erinnerungen";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronDown, ChevronRight, CircleHelp, Cog, LockKeyhole, LogOut, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import { usePrivatWechsel } from "@/components/layout/bereich";
import { BetreiberLink } from "@/components/layout/betreiber-link";
import { Blatt } from "@/components/privat/blatt";
import { Avatar } from "@/components/ui/avatar";
import { StartAnsichtSchalter } from "@/components/layout/start-ansicht-schalter";
import { useSession } from "@/context/session";
import { signOut } from "@/lib/auth/actions";
import { meinZweiFaktorStatus } from "@/lib/auth/zwei-faktor-actions";
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
 * Profil-Fenster auf dem Handy (Entwurf A): oben Name und Glocke, darunter
 * Betrieb | Privat und schlichte Listen in Gruppen – Schnell, Konto,
 * Startseite, Daten & Hilfe. Benachrichtigungen führen beim Antippen auf die
 * passende Seite. Ganz unten Abmelden. Jede Zeile bricht sauber um, nichts
 * ragt aus seinem Kasten.
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
  const { role, profile, company, echteRolle, ansicht, setAnsicht } = useSession();
  const router = useRouter();
  const privat = usePrivatWechsel(profile.hatPrivat === true);
  const ansichten = ROLLEN.filter((r) => ROLLEN.indexOf(r) < ROLLEN.indexOf(echteRolle));
  const ungelesen = (items ?? []).filter((n) => !n.readAt).length;
  const [mitteilungenOffen, setMitteilungenOffen] = useState(ungelesen > 0);
  const [zweiFaktor, setZweiFaktor] = useState<boolean | null>(null);

  useEffect(() => {
    let aktiv = true;
    meinZweiFaktorStatus()
      .then((s) => aktiv && setZweiFaktor(s?.aktiv ?? null))
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, []);

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

  function oeffne(n: LiveNotification) {
    if (!n.readAt) {
      markNotificationRead(n.id).catch(() => {});
      setItems((a) => (a ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.ziel) {
      onClose();
      router.push(n.ziel);
    }
  }

  return (
    <Blatt titel="Profil" onClose={onClose}>
      {/* Kopf: wer ist angemeldet, daneben die Glocke. */}
      <div className="flex items-center gap-3 pb-3">
        <Avatar employee={profile} className="h-11 w-11 shrink-0 bg-ink/[0.07] text-[15px] text-ink" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="truncate text-[13px] text-ink-muted">
            {roleLabels[role]}
            {company.name ? ` · ${company.name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMitteilungenOffen(true);
            requestAnimationFrame(() => document.getElementById("profil-benachrichtigungen")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
          aria-label={ungelesen ? `Benachrichtigungen, ${ungelesen} neu` : "Benachrichtigungen"}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-ink/[0.1] text-ink"
          data-zu-benachrichtigungen
        >
          <Bell className="h-[19px] w-[19px]" strokeWidth={1.7} />
          {ungelesen ? <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-crit-dot" /> : null}
        </button>
      </div>

      {/* Ein Login, zwei Bereiche. */}
      {!company.isDemo ? (
        <div role="group" aria-label="Bereich" className="mb-1 flex gap-5 border-b border-ink/[0.1] px-1">
          <span aria-current="page" className="-mb-px border-b-2 border-ink pb-2 pt-1 text-[14.5px] font-semibold">
            Betrieb
          </span>
          <button type="button" data-zum-privat onClick={privat.wechseln} className="-mb-px border-b-2 border-transparent pb-2 pt-1 text-[14.5px] font-semibold text-ink-faint">
            Privat
          </button>
        </div>
      ) : null}
      {privat.fenster}

      <Gruppe titel="Schnell">
        <button type="button" onClick={() => setMitteilungenOffen((o) => !o)} aria-expanded={mitteilungenOffen} className={ZEILE} data-benachrichtigungen-zeile>
          <Bell className={ICON} strokeWidth={1.7} />
          <span className="min-w-0 flex-1 truncate">Benachrichtigungen</span>
          {ungelesen > 0 ? <span className="shrink-0 rounded-full bg-ink px-1.5 text-[11.5px] font-semibold text-surface">{ungelesen}</span> : null}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", mitteilungenOffen && "rotate-180")} />
        </button>
        {mitteilungenOffen ? (
          <div id="profil-benachrichtigungen" className="scroll-mt-4 px-2 pb-2">
            <PushAnstoss className="mb-2" />
            {items === null ? (
              <p className="px-2 py-4 text-center text-[14px] text-ink-muted">wird geladen …</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-4 text-center text-[14px] text-ink-muted">Noch keine Benachrichtigungen.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-[12px] bg-ink/[0.04]">
                {items.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => oeffne(n)}
                    data-benachrichtigung-ziel={n.ziel ?? undefined}
                    className={cn("flex w-full items-start gap-2 px-3 py-2.5 text-left", i > 0 && "glas-linie border-t", beimOeffnen.has(n.id) && "bg-brand-500/10")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 text-[14px] font-medium">{n.title}</span>
                        <span className="shrink-0 text-[11.5px] text-ink-faint">{vor(n.createdAt)}</span>
                      </span>
                      <span className="block break-words text-[13px] leading-snug text-ink-muted">{n.body}</span>
                    </span>
                    {n.ziel ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <ZeileLink href="/meine-zahlen" onClick={onClose} icon={<TrendingUp className={ICON} strokeWidth={1.7} />} text="Meine Zahlen" />
      </Gruppe>

      <Gruppe titel="Konto">
        <ZeileLink href="/profil" onClick={onClose} icon={<UserRound className={ICON} strokeWidth={1.7} />} text="Profil & Stammdaten" />
        <ZeileLink
          href="/profil"
          onClick={onClose}
          icon={<ShieldCheck className={ICON} strokeWidth={1.7} />}
          text="Sicherheit"
          rechts={zweiFaktor === null ? undefined : zweiFaktor ? "Zwei-Faktor an" : "Zwei-Faktor aus"}
        />
        <ZeileLink href="/einstellungen" onClick={onClose} icon={<Cog className={ICON} strokeWidth={1.7} />} text="Einstellungen" />
        <BetreiberLink onClick={onClose} className={ZEILE} />
      </Gruppe>

      <Gruppe titel="Startseite">
        <div className="px-2 py-2">
          <StartAnsichtSchalter />
        </div>
      </Gruppe>

      <Gruppe titel="Daten & Hilfe">
        <ZeileLink href="/profil/datenschutz" onClick={onClose} icon={<LockKeyhole className={ICON} strokeWidth={1.7} />} text="Datenschutz & meine Daten" />
        <ZeileLink href="/hilfe" onClick={onClose} icon={<CircleHelp className={ICON} strokeWidth={1.7} />} text="Hilfe" />
      </Gruppe>

      {ansichten.length > 0 ? (
        <Gruppe titel="Ansicht">
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
                className={cn(ZEILE, aktiv && "font-semibold")}
              >
                <span className="min-w-0 flex-1">{wert === echteRolle ? `${roleLabels[wert]} (meine Rolle)` : `Als ${roleLabels[wert]} ansehen`}</span>
                {aktiv ? <span className="shrink-0 text-[12.5px] text-ink-muted">aktiv</span> : null}
              </button>
            );
          })}
        </Gruppe>
      ) : null}
      {ansichten.length > 0 ? <p className="px-1 pt-1.5 text-[12px] text-ink-faint">Nur die Anzeige wechselt – deine Rechte bleiben gleich.</p> : null}

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
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-ink/[0.1] text-[15px] font-semibold text-crit-fg active:opacity-80">
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} /> Abmelden
        </button>
      </form>
    </Blatt>
  );
}

const ZEILE = "flex w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left text-[15px] active:bg-ink/[0.06]";
const ICON = "h-[18px] w-[18px] shrink-0 text-ink-muted";

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="px-1 pb-1.5 text-[12px] font-semibold text-ink-faint">{titel}</h3>
      <div className="glas-linie divide-y divide-ink/[0.08] overflow-hidden rounded-[14px] border border-ink/[0.08] bg-ink/[0.03]">{children}</div>
    </section>
  );
}

function ZeileLink({ href, onClick, icon, text, rechts }: { href: string; onClick: () => void; icon: ReactNode; text: string; rechts?: string }) {
  return (
    <Link href={href} onClick={onClick} className={ZEILE}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {rechts ? <span className="shrink-0 text-[13px] text-ink-muted">{rechts}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </Link>
  );
}
