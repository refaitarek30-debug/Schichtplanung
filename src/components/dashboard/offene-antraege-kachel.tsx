"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useSession } from "@/context/session";
import { DataError, fetchReviewLeaveRequests } from "@/lib/data/leave";
import { formatDays, formatRange, heuteInBerlin } from "@/lib/dates";
import { gruppiereAntraege } from "@/lib/leave-groups";
import { useAktualisierung } from "@/lib/live-refresh";
import type { LiveLeaveRequest } from "@/lib/types";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";

/**
 * Startseite der Führung: die offenen Urlaubsanträge direkt in einer Kachel,
 * in sich scrollbar – getrennt nach diesem und nächstem Jahr. Ein Tipp öffnet
 * die Urlaubsanträge, wo mit Besetzungsprüfung entschieden wird.
 *
 * Gleicher Zwischenspeicher wie die Seite Urlaubsanträge: die Liste steht
 * sofort da und wird im Hintergrund aufgefrischt.
 */
export function OffeneAntraegeKachel() {
  const { profile } = useSession();
  const schluessel = `${profile.id}:antraege-fuehrung`;
  const [antraege, setAntraege] = useState<LiveLeaveRequest[] | null>(
    () => ausZwischenspeicher<LiveLeaveRequest[]>(schluessel) ?? null,
  );
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const neu = await fetchReviewLeaveRequests();
      setAntraege(neu);
      setFehler(null);
      inZwischenspeicher(schluessel, neu);
    } catch (e) {
      if (!ausZwischenspeicher(schluessel)) setAntraege([]);
      setFehler(e instanceof DataError ? e.message : "Die Anträge konnten nicht geladen werden.");
    }
  }, [schluessel]);

  useEffect(() => {
    // Laden setzt den Zustand erst nach der Antwort der Datenbank.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);
  useAktualisierung(["antraege"], () => void laden());

  const jahr = Number(heuteInBerlin().slice(0, 4));
  const gruppen = useMemo(() => {
    const offen = gruppiereAntraege(antraege ?? [])
      .filter((g) => g.status === "pending")
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return [
      { titel: `Dieses Jahr · ${jahr}`, liste: offen.filter((g) => Number(g.startDate.slice(0, 4)) <= jahr) },
      { titel: `Nächstes Jahr · ${jahr + 1}`, liste: offen.filter((g) => Number(g.startDate.slice(0, 4)) === jahr + 1) },
      { titel: "Später", liste: offen.filter((g) => Number(g.startDate.slice(0, 4)) > jahr + 1) },
    ].filter((g) => g.liste.length > 0);
  }, [antraege, jahr]);
  const anzahl = gruppen.reduce((n, g) => n + g.liste.length, 0);

  return (
    <div data-offene-antraege>
    <Card>
      <CardHeader
        title="Anträge zur Entscheidung"
        hint={
          antraege === null
            ? "wird geladen …"
            : anzahl > 0
              ? `${anzahl} warten auf deine Entscheidung`
              : "keine offenen Anträge"
        }
      />
      {fehler && anzahl === 0 ? <p className="px-5 pb-4 text-[13px] text-crit-fg">{fehler}</p> : null}
      {anzahl > 0 ? (
        <div className="max-h-[26rem] overflow-y-auto overscroll-contain border-t border-line" data-antraege-liste>
          {gruppen.map((g) => (
            <section key={g.titel}>
              <p className="sticky top-0 z-[1] bg-surface-muted px-5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                {g.titel} · {g.liste.length}
              </p>
              <ul className="divide-y divide-line">
                {g.liste.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/urlaubsantraege"
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">
                          {a.employeeName ?? "Mitarbeiter"}
                          {a.shiftName ? <span className="font-normal text-ink-faint"> · {a.shiftName}</span> : null}
                        </span>
                        <span className="tnum block text-[12.5px] text-ink-muted">
                          {formatRange(a.startDate, a.endDate)} · {formatDays(a.requestedDays)} Tage
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <div className="border-t border-line px-5 py-3">
        <Link href="/urlaubsantraege" className="text-[13px] font-medium text-brand-600 hover:underline">
          Zu den Urlaubsanträgen →
        </Link>
      </div>
    </Card>
    </div>
  );
}
