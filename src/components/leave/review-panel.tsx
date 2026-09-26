"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAktualisierung } from "@/lib/live-refresh";
import { Check, Search, ShieldCheck, TriangleAlert, Undo2, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
  staffingTone,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDays, formatRange, formatZeitpunkt, heuteInBerlin } from "@/lib/dates";
import { decideLeaveRequestAction, zuruecknehmenAction } from "@/lib/auth/leave-actions";
import { DataError, fetchSammelKandidaten, sicherGenehmigen } from "@/lib/data/leave";
import { meldeEigeneAenderung } from "@/lib/live-refresh";
import {
  fetchLeaveImpact,
  fetchLeaveStaffingDetail,
  type LiveStaffingDetailDay,
} from "@/lib/data/staffing";
import type { LiveLeaveImpact, LiveLeaveRequest } from "@/lib/types";
import { artenText, gruppiereAntraege } from "@/lib/leave-groups";
import { useSession } from "@/context/session";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export function ReviewPanel({
  requests,
  loading,
  onChanged,
}: {
  requests: LiveLeaveRequest[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  /** Jahr des Antrags (Beginn oder Ende); null = alle Jahre. */
  const [jahr, setJahr] = useState<number | null>(null);
  /** Fortschritt der Sammelgenehmigung: geprüft von gesamt. */
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  /** Genehmigten Antrag zurücknehmen: welcher, und mit welchem Grund. */
  const [zuruecknehmen, setZuruecknehmen] = useState<string | null>(null);
  const [ruecknahmeGrund, setRuecknahmeGrund] = useState("");
  const heute = heuteInBerlin();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<Record<string, LiveLeaveImpact | null>>({});
  /** Warum wird es knapp? Nur für die Anträge, die tatsächlich knapp sind. */
  const [details, setDetails] = useState<Record<string, LiveStaffingDetailDay[]>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);
  const { role } = useSession();
  const darfEntscheiden = role === "admin" || role === "shift_leader";
  const imJahr = (r: { startDate: string; endDate: string }) =>
    jahr === null ||
    Number(r.startDate.slice(0, 4)) === jahr ||
    Number(r.endDate.slice(0, 4)) === jahr;
  const offeneAnzahl = useMemo(
    () => gruppiereAntraege(requests ?? []).filter((r) => r.status === "pending" && imJahr(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests, jahr],
  );
  /** Jahre, in denen es Anträge gibt – plus das laufende. */
  const jahre = useMemo(() => {
    const menge = new Set<number>([new Date().getFullYear()]);
    for (const r of requests ?? []) {
      menge.add(Number(r.startDate.slice(0, 4)));
      menge.add(Number(r.endDate.slice(0, 4)));
    }
    return [...menge].sort((a, b) => a - b);
  }, [requests]);

  /**
   * Ein Zeitraum ist ein Antrag – auch wenn er in der Datenbank aus
   * mehreren Zeilen besteht. Genehmigt und abgelehnt wird immer der ganze
   * Zeitraum; eine Teilentscheidung über einzelne Tage oder über Urlaub
   * gegen V-Tag gibt es nicht. Die Datenbank setzt das durch, hier wird es
   * nur so dargestellt, wie es gilt.
   */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return gruppiereAntraege(requests ?? [])
      .filter((r) => (statusFilter === "all" ? r.status !== "withdrawn" : r.status === statusFilter))
      .filter(imJahr)
      .filter(
        (r) => term.length === 0 || (r.employeeName ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, statusFilter, search, jahr]);

  // Hat sich an Anträgen, Abwesenheiten oder dem Plan etwas geändert, gilt
  // keine der bisher gerechneten Besetzungsprüfungen mehr sicher: eine
  // andere Genehmigung kann genau die Lücke gerissen haben. Also alles
  // verwerfen – die neue Liste, die gleich eintrifft, löst die Prüfung neu
  // aus.
  const [pruefRunde, setPruefRunde] = useState(0);
  useAktualisierung(["antraege", "abwesenheiten", "plan"], () => {
    setImpacts({});
    setDetails({});
    setPruefRunde((n) => n + 1);
  });

  // Besetzungsprüfung für offene Anträge nachladen (Spezifikationspunkt 15:
  // "vor der Genehmigung erneut prüfen"). Nur für pending, nur einmal je Antrag.
  useEffect(() => {
    const openOnes = visible.filter((r) => r.status === "pending" && !(r.id in impacts));
    if (openOnes.length === 0) return;
    let cancelled = false;
    openOnes.forEach((request) => {
      fetchLeaveImpact(request.employeeId, request.startDate, request.endDate)
        .then((result) => {
          if (cancelled) return;
          setImpacts((current) => ({ ...current, [request.id]: result }));
          // Das Detail kostet je Tag eine Qualifikationsprüfung. Es wird
          // deshalb nur dort geholt, wo überhaupt etwas knapp ist – für
          // einen unbedenklichen Antrag gibt es nichts zu erklären.
          if (result.worstStatus === "ok") return;
          fetchLeaveStaffingDetail(request.employeeId, request.startDate, request.endDate)
            .then((tage) => {
              if (!cancelled) setDetails((current) => ({ ...current, [request.id]: tage }));
            })
            .catch(() => {});
        })
        .catch(() => {
          if (!cancelled) setImpacts((current) => ({ ...current, [request.id]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pruefRunde]);

  function approve(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await decideLeaveRequestAction(id, "approved");
      if (result.error) setError(result.error);
      setBusyId(null);
      onChanged();
    });
  }

  /**
   * Alles genehmigen, was niemanden in Bedrängnis bringt.
   *
   * Entschieden wird ausschliesslich in der Datenbank: dort laufen
   * dieselbe Besetzungsrechnung und dieselben Qualifikationsanforderungen
   * wie in der Warnung an jedem einzelnen Antrag, und zwar Antrag für
   * Antrag nacheinander – zwei einzeln unbedenkliche Anträge dürfen die
   * Schicht nicht gemeinsam leerräumen.
   */
  function sammelGenehmigen() {
    setError(null);
    setHinweis(null);
    setBusyId("sammel");
    startTransition(async () => {
      // Antrag für Antrag, in der Reihenfolge des Eingangs. Jeder einzelne
      // Aufruf prüft vollständig gegen den Stand NACH den vorigen
      // Genehmigungen – zwei einzeln unbedenkliche Anträge können die
      // Schicht so nicht gemeinsam leerräumen. Das darf bei vielen Anträgen
      // ruhig eine halbe Minute dauern.
      try {
        const ids = await fetchSammelKandidaten(jahr);
        setFortschritt({ fertig: 0, gesamt: ids.length });
        let genehmigt = 0;
        let uebersprungen = 0;
        for (const [i, id] of ids.entries()) {
          try {
            const ergebnis = await sicherGenehmigen(id);
            if (ergebnis.genehmigt) genehmigt++;
            else uebersprungen++;
          } catch {
            uebersprungen++;
          }
          setFortschritt({ fertig: i + 1, gesamt: ids.length });
        }
        setHinweis(
          ids.length === 0
            ? "Es liegen keine offenen Anträge vor."
            : genehmigt === 0
              ? `Kein Antrag war ohne Weiteres genehmigungsfähig. ${uebersprungen} bleiben ausstehend.`
              : `${genehmigt} ${genehmigt === 1 ? "Antrag" : "Anträge"} genehmigt, ${uebersprungen} ${uebersprungen === 1 ? "bleibt" : "bleiben"} ausstehend.`,
        );
      } catch (caught) {
        // Nur die eigenen, verständlichen Meldungen durchreichen – nie einen
        // technischen Fehlertext.
        setError(
          caught instanceof DataError ? caught.message : "Die Sammelgenehmigung ist fehlgeschlagen.",
        );
      }
      setFortschritt(null);
      setBusyId(null);
      onChanged();
    });
  }

  /**
   * Einen genehmigten Antrag zurücknehmen. Die Datenbank prüft, ob man über
   * die Person entscheiden darf und ob der Zeitraum noch nicht begonnen hat,
   * setzt den Antrag auf „zurückgezogen“ und benachrichtigt die Person.
   */
  function ruecknahme(id: string) {
    setError(null);
    setHinweis(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await zuruecknehmenAction(id, ruecknahmeGrund);
      if (result.error) setError(result.error);
      else setHinweis(result.success ?? null);
      setBusyId(null);
      setZuruecknehmen(null);
      setRuecknahmeGrund("");
      onChanged();
      if (!result.error) meldeEigeneAenderung(["antraege"]);
    });
  }

  function reject(id: string) {
    if (!rejectionReason.trim()) {
      setError("Für eine Ablehnung ist eine Begründung erforderlich.");
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await decideLeaveRequestAction(id, "rejected", rejectionReason);
      if (result.error) setError(result.error);
      setBusyId(null);
      setRejecting(null);
      setRejectionReason("");
      onChanged();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Urlaubsanträge"
        hint={requests ? `${visible.length} Anträge` : "wird geladen …"}
      />

      {role === "shift_leader" ? (
        <p className="border-b border-line bg-surface-muted px-5 py-2 text-[12px] leading-snug text-ink-muted">
          Du siehst und entscheidest nur die Anträge deiner eigenen Schicht, deine eigenen
          eingeschlossen.
        </p>
      ) : null}

      {/* Sammelgenehmigung nur für die Führung und nur, wenn es überhaupt
          etwas zu entscheiden gibt. Die Rollenprüfung hier ist
          Bequemlichkeit – verbindlich weist
          approve_safe_leave_requests() in der Datenbank ab. */}
      {darfEntscheiden && offeneAnzahl > 0 ? (
        <div className="border-b border-line px-5 py-3">
          <button
            type="button"
            disabled={pending}
            onClick={sammelGenehmigen}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-[15px] font-semibold text-white shadow-md ring-1 ring-emerald-700/30 transition hover:brightness-110 disabled:opacity-70 sm:w-auto"
          >
            <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
            {busyId === "sammel"
              ? fortschritt
                ? `wird geprüft … ${fortschritt.fertig} von ${fortschritt.gesamt}`
                : "wird geprüft …"
              : `Alle sicheren Anträge genehmigen${jahr ? ` (${jahr})` : ""} · ${offeneAnzahl} offen`}
          </button>
          {fortschritt && fortschritt.gesamt > 0 ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted sm:max-w-sm">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width]"
                style={{ width: `${Math.round((fortschritt.fertig / fortschritt.gesamt) * 100)}%` }}
              />
            </div>
          ) : null}
          <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
            Jeder Antrag wird einzeln geprüft: genehmigt nur, wo danach Soll- und Mindestbesetzung
            stehen und alle geforderten Qualifikationen besetzt bleiben. Alles andere bleibt
            ausstehend. Bei vielen Anträgen kann das bis zu einer halben Minute dauern.
          </p>
          {hinweis ? (
            <div className="mt-2">
              <Alert tone="success">{hinweis}</Alert>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mitarbeiter suchen"
            className="pl-9"
            aria-label="Mitarbeiter suchen"
          />
        </div>
        <select
          value={jahr ?? ""}
          onChange={(e) => setJahr(e.target.value ? Number(e.target.value) : null)}
          aria-label="Nach Jahr filtern"
          className="tnum rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Alle Jahre</option>
          {jahre.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Nach Status filtern"
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="pending">Offen</option>
          <option value="approved">Genehmigt</option>
          <option value="rejected">Abgelehnt</option>
          <option value="all">Alle</option>
        </select>
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {hinweis && !(darfEntscheiden && offeneAnzahl > 0) ? (
        <div className="px-5 pt-4">
          <Alert tone="success">{hinweis}</Alert>
        </div>
      ) : null}

      <CardBody className="space-y-3 px-3 py-3">
        {loading ? (
          <RowSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              statusFilter === "pending"
                ? "Keine offenen Anträge."
                : "Keine Anträge für diesen Filter."
            }
          />
        ) : (
          visible.map((request) => (
            <article key={request.id} className="rounded-xl border border-line px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {request.employeeName ?? "Unbekannt"}
                    {request.shiftName ? (
                      <span className="font-normal text-ink-faint"> · {request.shiftName}</span>
                    ) : null}
                  </p>
                  <p className="tnum text-[13px] text-ink-muted">
                    {formatRange(request.startDate, request.endDate)} ·{" "}
                    {formatDays(request.requestedDays)} Tage · {artenText(request.kinds)}
                  </p>
                  {request.reason ? (
                    <p className="mt-1 text-[13px] italic text-ink-muted">„{request.reason}“</p>
                  ) : null}
                  {request.status === "rejected" && request.rejectionReason ? (
                    <p className="mt-1 text-[13px] text-crit-fg">
                      Grund: {request.rejectionReason}
                    </p>
                  ) : null}
                  <p className="tnum mt-1 text-[12px] text-ink-faint">
                    Antrag gestellt am {formatZeitpunkt(request.createdAt)}
                  </p>
                </div>
                <Badge tone={leaveStatusTone[request.status]}>
                  {leaveStatusLabel[request.status]}
                </Badge>
              </div>

              {request.status === "pending" && impacts[request.id] ? (
                <ImpactHint impact={impacts[request.id]!} tage={details[request.id]} />
              ) : null}

              {request.status === "pending" ? (
                rejecting === request.id ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Begründung für die Ablehnung"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        disabled={pending && busyId === request.id}
                        onClick={() => reject(request.actionId)}
                      >
                        Ablehnung bestätigen
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRejecting(null);
                          setRejectionReason("");
                          setError(null);
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      disabled={pending && busyId === request.id}
                      onClick={() => approve(request.actionId)}
                    >
                      <Check className="h-4 w-4" /> Genehmigen
                    </Button>
                    <Button
                      variant="danger"
                      disabled={pending && busyId === request.id}
                      onClick={() => setRejecting(request.id)}
                    >
                      <X className="h-4 w-4" /> Ablehnen
                    </Button>
                  </div>
                )
              ) : null}

              {/* Genehmigt und noch nicht begonnen: zurücknehmen. Hat der
                  Zeitraum schon begonnen, entfernt man einzelne Tage im
                  Schichtplan. */}
              {darfEntscheiden && request.status === "approved" && request.startDate > heute ? (
                zuruecknehmen === request.id ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={ruecknahmeGrund}
                      onChange={(e) => setRuecknahmeGrund(e.target.value)}
                      placeholder="Grund (optional) – steht in der Mitteilung an die Person"
                      maxLength={300}
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="danger"
                        disabled={pending && busyId === request.id}
                        onClick={() => ruecknahme(request.actionId)}
                      >
                        Ja, zurücknehmen
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setZuruecknehmen(null);
                          setRuecknahmeGrund("");
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button variant="ghost" onClick={() => setZuruecknehmen(request.id)}>
                      <Undo2 className="h-4 w-4" /> Zurücknehmen
                    </Button>
                  </div>
                )
              ) : null}
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** Besetzungsprüfung zu einem einzelnen offenen Antrag – vor der Entscheidung sichtbar. */
/**
 * Warum ist es knapp?
 *
 * Unterschieden wird ausdrücklich zwischen zwei Lagen, weil sie
 * unterschiedlich schwer wiegen:
 *
 *   „Mindestbesetzung gefährdet"  – unter der harten Untergrenze
 *   „Sollbesetzung unterschritten" – noch über der Untergrenze, aber
 *                                    unter der gewünschten Stärke
 *
 * Die Qualifikationen darunter kommen aus `shift_qualification_needs`,
 * also aus der Konfiguration in der Verwaltung. Im Frontend steht keine
 * einzige Anforderung fest verdrahtet.
 */
function ImpactHint({
  impact,
  tage,
}: {
  impact: LiveLeaveImpact;
  tage?: LiveStaffingDetailDay[];
}) {
  // Nur wenn tatsächlich etwas unterschritten wird. Dass noch jemand aus
  // der Schicht frei hat, ist allein kein Grund zur Warnung – solange die
  // Sollbesetzung steht, ist der Antrag unbedenklich.
  if (impact.worstStatus === "ok") return null;

  const kritisch = impact.worstStatus === "critical";

  // Über alle betroffenen Tage: was fehlt, und wie oft höchstens.
  const luecken = new Map<string, number>();
  for (const tag of tage ?? []) {
    for (const g of tag.gaps) {
      luecken.set(g.label, Math.max(luecken.get(g.label) ?? 0, g.fehlt));
    }
  }
  const sollTage = (tage ?? []).filter((t) => t.status === "warn").length;
  const mindestTage = (tage ?? []).filter((t) => t.status === "critical").length;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] leading-snug text-ink-muted">
      <TriangleAlert
        className={
          kritisch
            ? "mt-0.5 h-4 w-4 shrink-0 text-crit-fg"
            : "mt-0.5 h-4 w-4 shrink-0 text-warn-fg"
        }
        strokeWidth={2}
      />
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <Badge tone={staffingTone[impact.worstStatus]}>
            {kritisch ? "Mindestbesetzung gefährdet" : "Sollbesetzung unterschritten"}
          </Badge>
          {mindestTage > 0 || sollTage > 0 ? (
            <span className="tnum text-[12px]">
              {kritisch
                ? `an ${mindestTage === 1 ? "einem Tag" : `${mindestTage} Tagen`}`
                : `an ${sollTage === 1 ? "einem Tag" : `${sollTage} Tagen`}`}
            </span>
          ) : null}
        </p>

        {luecken.size > 0 ? (
          <div>
            <p className="font-medium text-ink">Gefährdet:</p>
            <ul className="tnum mt-0.5 space-y-0.5">
              {[...luecken.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([label, fehlt]) => (
                  <li key={label}>
                    – {fehlt}× {label}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {impact.overlappingEmployees > 0 ? (
          <p>
            {impact.overlappingEmployees}{" "}
            {impact.overlappingEmployees === 1 ? "weitere Person" : "weitere Personen"} derselben
            Schicht in diesem Zeitraum bereits abwesend oder mit offenem Antrag.
          </p>
        ) : null}
      </div>
    </div>
  );
}
