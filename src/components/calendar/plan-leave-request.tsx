"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDE, formatDays } from "@/lib/dates";
import {
  fetchAutoPreview,
  fetchLeaveDayCount,
  fetchMyLeaveBalance,
  fetchMyLeaveKindQuotas,
} from "@/lib/data/leave";
import { fetchLeaveBlockReason } from "@/lib/data/staffing";
import { submitLeaveRequest } from "@/lib/auth/leave-actions";
import type { LiveAutoDay, LiveLeaveBalance, LiveLeaveKindQuota } from "@/lib/types";
import { leaveKindLabels } from "@/lib/types";

type Art =
  | "auto"
  | "urlaub"
  | "v_tag"
  | "altersfreizeit"
  | "sonderurlaub"
  | "bildungsurlaub"
  | "gewerkschaftstag";

const KONTINGENT_ARTEN = [
  "altersfreizeit",
  "sonderurlaub",
  "bildungsurlaub",
  "gewerkschaftstag",
] as const;

/**
 * Urlaub direkt aus der eigenen Zeile im Schichtplan beantragen.
 *
 * Bewusst KEIN zweiter Antragsweg: abgeschickt wird über dieselbe
 * Serveraktion wie auf der Urlaubsseite (`submitLeaveRequest`), gezählt
 * wird mit derselben Funktion wie beim Speichern, und die
 * Qualifikationsprüfung ist dieselbe, die die Datenbank beim Speichern
 * erzwingt. Was hier „geht" sagt, geht also auch durch.
 *
 * Die Art steht auf „Automatisch", bis die Person selbst etwas anderes
 * wählt – wie im Formular auf der Urlaubsseite.
 */
export function PlanLeaveRequest({
  employeeId,
  von,
  bis,
  fertig,
  onEinTag,
  onClose,
  onDone,
}: {
  employeeId: string;
  von: string;
  bis: string;
  /** false, solange erst ein Tag angetippt ist. */
  fertig: boolean;
  /** Nur den einen angetippten Tag beantragen. */
  onEinTag: () => void;
  onClose: () => void;
  onDone: (meldung: string) => void;
}) {
  const [art, setArt] = useState<Art>("auto");
  const [kommentar, setKommentar] = useState("");
  const [tage, setTage] = useState<number | null>(null);
  const [auto, setAuto] = useState<LiveAutoDay[] | null>(null);
  const [sperrGrund, setSperrGrund] = useState<string | null>(null);
  const [konto, setKonto] = useState<LiveLeaveBalance | null>(null);
  const [kontingente, setKontingente] = useState<LiveLeaveKindQuota[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, startTransition] = useTransition();

  const jahr = Number(von.slice(0, 4));

  // Konto und Kontingente des Jahres, in dem der Zeitraum beginnt – nicht
  // das des laufenden Jahres.
  useEffect(() => {
    if (!fertig) return;
    let cancelled = false;
    Promise.all([
      fetchMyLeaveBalance(jahr).catch(() => null),
      fetchMyLeaveKindQuotas(jahr).catch(() => [] as LiveLeaveKindQuota[]),
    ]).then(([k, q]) => {
      if (cancelled) return;
      setKonto(k);
      setKontingente(q);
    });
    return () => {
      cancelled = true;
    };
  }, [jahr, fertig]);

  // Tage, Automatik-Vorschau und Qualifikationsprüfung für den Zeitraum.
  // Über den Jahreswechsel zählt der Server die Tage je Jahr; für die
  // Anzeige hier genügt die Summe.
  useEffect(() => {
    // Erst fragen, wenn der Zeitraum feststeht. Der erste Tipp ist nur ein
    // Zwischenstand – vier Abfragen dafür wären gleich wieder überholt.
    if (!fertig) return;
    let cancelled = false;
    setTage(null);
    setAuto(null);
    setSperrGrund(null);
    setFehler(null);
    fetchLeaveDayCount(employeeId, von, bis)
      .then((n) => !cancelled && setTage(n))
      .catch(() => !cancelled && setTage(null));
    fetchAutoPreview(von, bis)
      .then((tageListe) => !cancelled && setAuto(tageListe))
      .catch(() => !cancelled && setAuto([]));
    fetchLeaveBlockReason(employeeId, von, bis)
      .then((grund) => !cancelled && setSperrGrund(grund))
      .catch(() => !cancelled && setSperrGrund(null));
    return () => {
      cancelled = true;
    };
  }, [employeeId, von, bis, fertig]);

  const autoUrlaub = (auto ?? []).filter((t) => t.kind === "urlaub").length;
  const autoV = (auto ?? []).filter((t) => t.kind === "v_tag").length;
  const autoOffen = (auto ?? []).filter((t) => t.kind === "keins").length;

  const rest =
    art === "urlaub"
      ? (konto?.remainingDays ?? null)
      : art === "v_tag"
        ? (konto?.vRemainingDays ?? null)
        : art === "auto"
          ? null
          : (kontingente.find((q) => q.kind === art)?.rest ?? null);
  const reichtNicht = rest !== null && tage !== null && rest - tage < 0;

  const gesperrt =
    sendet ||
    Boolean(sperrGrund) ||
    tage === null ||
    tage === 0 ||
    reichtNicht ||
    (art === "auto" && (auto === null || auto.length === 0 || autoOffen > 0));

  function absenden() {
    setFehler(null);
    const fd = new FormData();
    fd.set("start_date", von);
    fd.set("end_date", bis);
    fd.set("kind", art);
    fd.set("reason", kommentar);
    startTransition(async () => {
      const ergebnis = await submitLeaveRequest({}, fd);
      if (ergebnis.error) {
        setFehler(ergebnis.error);
        return;
      }
      onDone(ergebnis.success ?? "Antrag eingereicht – Status: Ausstehend.");
    });
  }

  const leiste =
    "fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl rounded-t-2xl border border-line bg-surface px-4 py-3 shadow-pop lg:bottom-4 lg:rounded-2xl";

  // Bis zum zweiten Tipp nur eine schmale Leiste. Das volle Feld würde sonst
  // genau die Zeile verdecken, in der man als Nächstes tippen will.
  if (!fertig) {
    return (
      <div role="dialog" aria-label="Urlaub beantragen" className={leiste}>
        <p className="tnum text-[14px] font-semibold">Beginn: {formatDE(von)}</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Jetzt in deiner Zeile den letzten Tag antippen.
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={onEinTag}>
            Nur diesen Tag
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    // Als Leiste am unteren Rand, direkt über der Navigation. Stünde das
    // Feld oben über der Tabelle, wäre es auf dem Handy außer Sicht, sobald
    // man zur eigenen Zeile gescrollt hat – und für den zweiten Tipp müsste
    // man wieder zurück.
    <div
      role="dialog"
      aria-label="Urlaub beantragen"
      className={`${leiste} max-h-[60vh] overflow-y-auto`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="tnum text-[14px] font-semibold">
          Urlaub beantragen: {von === bis ? formatDE(von) : `${formatDE(von)} – ${formatDE(bis)}`}
        </p>
        <p className="tnum text-[13px] text-ink-muted">
          {tage === null ? "wird gezählt …" : `${formatDays(tage)} Arbeitstag${tage === 1 ? "" : "e"}`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-muted">Art</span>
          <select
            value={art}
            onChange={(e) => setArt(e.target.value as Art)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base sm:text-sm"
          >
            <option value="auto">Automatisch verteilen</option>
            <option value="urlaub">
              Urlaubstag{konto ? ` · ${formatDays(konto.remainingDays)} übrig` : ""}
            </option>
            <option value="v_tag">
              V-Tag{konto ? ` · ${formatDays(konto.vRemainingDays)} übrig` : ""}
            </option>
            {KONTINGENT_ARTEN.map((k) => {
              const q = kontingente.find((x) => x.kind === k);
              if (!q?.erlaubt) return null;
              return (
                <option key={k} value={k}>
                  {leaveKindLabels[k]} · {formatDays(Math.max(q.rest, 0))} übrig
                </option>
              );
            })}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-muted">
            Kommentar (optional)
          </span>
          <input
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="z. B. Familienurlaub"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base placeholder:text-ink-faint sm:text-sm"
          />
        </label>
      </div>

      {art === "auto" && auto && auto.length > 0 ? (
        <p className="mt-2 text-[13px] text-ink-muted">
          Automatisch: {autoUrlaub} Urlaubstag{autoUrlaub === 1 ? "" : "e"}, {autoV} V-Tag
          {autoV === 1 ? "" : "e"}
          {autoOffen > 0 ? ` · ${autoOffen} Tag(e) nicht gedeckt` : ""}.
        </p>
      ) : null}

      {tage === 0 ? (
        <p className="mt-2 text-[13px] text-ink-muted">
          In diesem Zeitraum hast du keine eingeplante Schicht – es gibt nichts zu beantragen.
        </p>
      ) : null}

      {reichtNicht ? (
        <div className="mt-2">
          <Alert tone="error">
            Dafür reicht das Konto {jahr} nicht ({formatDays(Math.max(rest ?? 0, 0))} übrig). Andere
            Art wählen oder „Automatisch verteilen“.
          </Alert>
        </div>
      ) : null}

      {sperrGrund ? (
        <div className="mt-2">
          <Alert tone="error">{sperrGrund}</Alert>
        </div>
      ) : null}

      {fehler ? (
        <div className="mt-2">
          <Alert tone="error">{fehler}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button onClick={absenden} disabled={gesperrt}>
          {sendet ? "Wird gesendet …" : "Beantragen"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={sendet}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
