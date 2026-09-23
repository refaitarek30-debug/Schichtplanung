"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { DateRangeCalendar } from "./date-range-calendar";
import { addDays as addDaysISO, formatDE, formatDays, fromISO as fromISOLocal } from "@/lib/dates";
import { previewLeaveDays } from "@/lib/leave-days";
import { fetchHolidays } from "@/lib/data/holidays";
import { fetchLeaveBlockReason, fetchLeaveImpact } from "@/lib/data/staffing";
import {
  fetchAutoPreview,
  fetchLeaveDayCount,
  fetchLeaveKindSuggestion,
  fetchMyLeaveBalance,
  fetchMyLeaveKindQuotas,
} from "@/lib/data/leave";
import { fetchBlockedDays, fetchMyShiftPlan } from "@/lib/data/rotation";
import { submitLeaveRequest } from "@/lib/auth/leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import type {
  Holiday,
  LiveAutoDay,
  LiveLeaveBalance,
  LiveLeaveImpact,
  LiveLeaveKindQuota,
  LiveLeaveKindSuggestion,
  LiveLeaveRequest,
} from "@/lib/types";
import { leaveKindLabels } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState: FormState = {};

type LeaveKind =
  | "auto"
  | "urlaub"
  | "v_tag"
  | "altersfreizeit"
  | "sonderurlaub"
  | "bildungsurlaub"
  | "gewerkschaftstag";

const kindLabels: Record<LeaveKind, { plural: string; action: string }> = {
  auto: { plural: "Tage", action: "Zeitraum einreichen" },
  urlaub: { plural: "Urlaubstage", action: "Urlaub beantragen" },
  v_tag: { plural: "V-Tage", action: "V-Tag beantragen" },
  altersfreizeit: { plural: "Tage Altersfreizeit", action: "Altersfreizeit beantragen" },
  sonderurlaub: { plural: "Tage Sonderurlaub", action: "Sonderurlaub beantragen" },
  bildungsurlaub: { plural: "Tage Bildungsurlaub", action: "Bildungsurlaub beantragen" },
  gewerkschaftstag: { plural: "Gewerkschaftstage", action: "Gewerkschaftstag beantragen" },
};

/** Die vier Arten mit Jahreskontingent, in der Reihenfolge der Auswahl. */
const KONTINGENT_ARTEN = [
  "altersfreizeit",
  "sonderurlaub",
  "bildungsurlaub",
  "gewerkschaftstag",
] as const;

/** Schichtname auf das Kürzel bringen, wie im Schichtplan. */
function shiftCode(name: string | null): string | null {
  if (!name) return null;
  if (/^Früh/i.test(name)) return "F";
  if (/^Spät/i.test(name)) return "S";
  if (/^Nacht/i.test(name)) return "N";
  return name.slice(0, 1).toUpperCase();
}

export function LiveLeaveRequestForm({
  employeeId,
  balance,
  today,
  onSubmitted,
  meineAntraege,
}: {
  employeeId: string | null;
  balance: LiveLeaveBalance | null;
  today: string;
  onSubmitted: () => void;
  /** Eigene Anträge, um belegte Tage im Kalender zu markieren. */
  meineAntraege?: LiveLeaveRequest[] | null;
}) {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<LiveLeaveImpact | null>(null);
  /** Immer "Automatisch", bis die Person selbst eine Art wählt. */
  const [kind, setKind] = useState<LeaveKind>("auto");
  const [suggestion, setSuggestion] = useState<LiveLeaveKindSuggestion | null>(null);
  /** Jahreskontingente der vier Arten ohne Urlaubskonto. */
  const [kontingente, setKontingente] = useState<LiveLeaveKindQuota[]>([]);
  /**
   * Urlaubskonto des Jahres, in dem der gewählte Zeitraum liegt.
   *
   * Das Konto aus der Seite (`balance`) hängt am Auswahlfeld der
   * Kontokarte und kann auf einem ganz anderen Jahr stehen. Wer im Herbst
   * 2026 einen Urlaub im März 2027 plant, wurde dadurch gegen das Konto
   * 2026 geprüft – und der Antrag ließ sich nicht abschicken, obwohl das
   * Konto 2027 voll war. Deshalb fragt das Formular das Jahr selbst.
   *
   * Geht der Zeitraum über den Jahreswechsel, werden beide Jahre geladen
   * und jedes gegen seinen eigenen Teil geprüft.
   */
  const [konten, setKonten] = useState<Map<number, LiveLeaveBalance | null>>(new Map());
  /** Eigene Schicht je Tag für den Kalender – F, S, N oder null (frei). */
  const [shiftDays, setShiftDays] = useState<Map<string, string | null>>(new Map());
  /** Vorschau der automatischen Verteilung. */
  const [autoDays, setAutoDays] = useState<LiveAutoDay[] | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  /** Gesperrte Tage im gewählten Zeitraum: Tag → Grund der Sperre. */
  const [sperren, setSperren] = useState<Map<string, string>>(new Map());
  const [state, formAction] = useActionState(submitLeaveRequest, initialState);

  // Echte Feiertage des Unternehmens statt der Demo-Feiertage aus Phase 1 –
  // sonst kann die Vorschau von dem abweichen, was der Server (Trigger
  // leave_requests_compute_days) am Ende tatsächlich speichert.
  /**
   * Tage, an denen schon etwas steht. Genehmigt sticht beantragt – wer
   * beides hat, soll das stärkere Signal sehen.
   *
   * Zurückgezogene und abgelehnte Anträge zählen bewusst nicht: die Tage
   * sind wieder frei.
   */
  const belegteTage = useMemo(() => {
    const karte = new Map<string, "genehmigt" | "beantragt">();
    for (const antrag of meineAntraege ?? []) {
      if (antrag.status !== "approved" && antrag.status !== "pending") continue;
      const marke = antrag.status === "approved" ? "genehmigt" : "beantragt";
      let tag = antrag.startDate;
      // Obergrenze gegen eine Endlosschleife bei kaputten Datumsangaben.
      for (let i = 0; tag <= antrag.endDate && i < 400; i++) {
        if (marke === "genehmigt" || !karte.has(tag)) karte.set(tag, marke);
        tag = addDaysISO(tag, 1);
      }
    }
    return karte;
  }, [meineAntraege]);

  /**
   * Die Datumsauswahl, nachdem sie kurz stillsteht.
   *
   * Einen Zeitraum wählt man mit zwei Klicks. Der erste erzeugt einen
   * Zwischenstand (Start = Ende), der sofort vier Abfragen auslöst –
   * Sperren, Besetzung, Automatikvorschau, Empfehlung –, die einen
   * Wimpernschlag später alle überholt sind. Auf dem Handy über Mobilfunk
   * war das der spürbare Hänger.
   *
   * 300 ms sind kurz genug, dass niemand wartet, und lang genug, dass der
   * Zwischenstand nicht mehr über die Leitung geht.
   */
  const [stabil, setStabil] = useState({ von: startDate, bis: endDate });
  useEffect(() => {
    const uhr = window.setTimeout(() => setStabil({ von: startDate, bis: endDate }), 300);
    return () => window.clearTimeout(uhr);
  }, [startDate, endDate]);

  const startJahr = Number(startDate.slice(0, 4));
  const endJahr = Number(endDate.slice(0, 4));

  // Die Konten der berührten Jahre. fetchMyLeaveBalance legt das Konto des
  // Jahres an, falls es noch fehlt – dieselbe Funktion nutzt auch die
  // Kontokarte, die Zahlen können also nicht auseinanderlaufen.
  useEffect(() => {
    const jahre = startJahr === endJahr ? [startJahr] : [startJahr, endJahr];
    if (jahre.some((j) => !Number.isInteger(j) || j < 2000 || j > 2100)) return;
    let cancelled = false;
    Promise.all(jahre.map((j) => fetchMyLeaveBalance(j).catch(() => null)))
      .then((ergebnisse) => {
        if (cancelled) return;
        setKonten(new Map(jahre.map((j, i) => [j, ergebnisse[i] ?? null])));
      })
      .catch(() => {
        if (!cancelled) setKonten(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [startJahr, endJahr]);

  // Die Kontingente hängen am Jahr des Startdatums: ein Antrag im Januar
  // greift auf ein anderes Jahr zu als einer im Dezember.
  useEffect(() => {
    let cancelled = false;
    fetchMyLeaveKindQuotas(Number(startDate.slice(0, 4)))
      .then((result) => {
        if (!cancelled) setKontingente(result);
      })
      .catch(() => {
        if (!cancelled) setKontingente([]);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate]);

  useEffect(() => {
    let cancelled = false;
    fetchHolidays()
      .then((result) => {
        if (!cancelled) setHolidays(result);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Urlaubssperren im gewählten Zeitraum. Der Schichtplan zeigt sie längst,
  // im Antragsformular waren sie unsichtbar – man stellte den Antrag und
  // erfuhr erst bei der Ablehnung davon.
  useEffect(() => {
    if (endDate < startDate) {
      setSperren(new Map());
      return;
    }
    let cancelled = false;
    fetchBlockedDays(stabil.von, stabil.bis)
      .then((result) => {
        if (!cancelled) setSperren(result);
      })
      .catch(() => {
        if (!cancelled) setSperren(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [stabil]);

  /** Gesperrte Tage des Zeitraums, nach Datum sortiert. */
  const gesperrt = useMemo(
    () =>
      [...sperren.entries()]
        .map(([tag, grund]) => ({ tag, grund }))
        .sort((a, b) => a.tag.localeCompare(b.tag)),
    [sperren],
  );

  /** Jeder Grund einmal – mehrere Tage derselben Sperre nennen ihn sonst mehrfach. */
  const sperrGruende = useMemo(
    () => [...new Set(gesperrt.map((s) => s.grund).filter(Boolean))],
    [gesperrt],
  );

  const valid = endDate >= startDate;

  /**
   * Tage je Kalenderjahr, gezählt vom Server – nach den eingeplanten
   * Schichten dieser Person, nicht nach Montag bis Freitag.
   *
   * null = wird gerade gezählt. `zaehlFehler` = der Server hat nicht
   * geantwortet; dann blockiert das Formular nicht, die verbindliche
   * Zählung passiert beim Speichern ohnehin.
   */
  const [serverTage, setServerTage] = useState<Map<number, number> | null>(null);
  const [zaehlFehler, setZaehlFehler] = useState(false);

  useEffect(() => {
    if (!employeeId || stabil.bis < stabil.von) {
      setServerTage(null);
      return;
    }
    let cancelled = false;
    setServerTage(null);
    setZaehlFehler(false);
    const vonJahr = Number(stabil.von.slice(0, 4));
    const bisJahr = Number(stabil.bis.slice(0, 4));
    // Über den Jahreswechsel: jedes Jahr für sich, weil jedes Konto nur
    // seinen eigenen Teil tragen muss.
    const abschnitte: [number, string, string][] =
      vonJahr === bisJahr
        ? [[vonJahr, stabil.von, stabil.bis]]
        : [
            [vonJahr, stabil.von, `${vonJahr}-12-31`],
            [bisJahr, `${bisJahr}-01-01`, stabil.bis],
          ];
    Promise.all(abschnitte.map(([, von, bis]) => fetchLeaveDayCount(employeeId, von, bis)))
      .then((zahlen) => {
        if (cancelled) return;
        setServerTage(new Map(abschnitte.map(([jahr], i) => [jahr, zahlen[i] ?? 0])));
      })
      .catch(() => {
        if (cancelled) return;
        setZaehlFehler(true);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, stabil]);

  /** Nur ohne Personalstammsatz oder wenn der Server schweigt: die alte Schätzung. */
  const schaetzung = useMemo(
    () => (valid && holidays ? previewLeaveDays(startDate, endDate, holidays, null) : 0),
    [startDate, endDate, valid, holidays],
  );
  const zaehltNoch = Boolean(employeeId) && valid && serverTage === null && !zaehlFehler;
  const days = serverTage
    ? [...serverTage.values()].reduce((summe, n) => summe + n, 0)
    : schaetzung;

  useEffect(() => {
    if (!employeeId || !valid) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    fetchLeaveImpact(employeeId, stabil.von, stabil.bis)
      .then((result) => {
        if (!cancelled) setImpact(result);
      })
      .catch(() => {
        if (!cancelled) setImpact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, stabil, valid]);

  /**
   * Fehlt durch diesen Antrag eine geforderte Qualifikation? Dann steht hier
   * der Grund, und der Knopf wird gar nicht erst angeboten. Die Datenbank
   * sperrt beim Speichern ohnehin mit derselben Regel.
   */
  const [sperrGrund, setSperrGrund] = useState<string | null>(null);
  useEffect(() => {
    if (!employeeId || stabil.bis < stabil.von) {
      setSperrGrund(null);
      return;
    }
    let cancelled = false;
    fetchLeaveBlockReason(employeeId, stabil.von, stabil.bis)
      .then((grund) => {
        if (!cancelled) setSperrGrund(grund);
      })
      .catch(() => {
        // Nicht blockieren, wenn die Abfrage scheitert – die Sperre beim
        // Speichern greift trotzdem und meldet den Grund dann dort.
        if (!cancelled) setSperrGrund(null);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, stabil]);

  /**
   * Eigene Schichten für den Kalender.
   *
   * Drei Dinge, die vorher gefehlt haben und das Blättern zäh bis kaputt
   * gemacht haben:
   *
   *   * Jeder Monatswechsel lud neu, auch ein schon geladener Monat.
   *   * `setShiftDays(map)` ersetzte die ganze Karte – der vorige Monat
   *     war danach weg und musste beim Zurückblättern wieder geholt werden.
   *   * Ohne Abbruchlogik konnte eine ältere Antwort eine neuere
   *     überschreiben. Wer schnell blätterte, sah dann die Schichten eines
   *     Monats, den er längst verlassen hatte – oder gar keine.
   *
   * Jetzt: einmal je Monat, zusammenführen statt ersetzen, und nur die
   * Antwort auf die zuletzt gestellte Frage wird übernommen.
   */
  const geladeneMonate = useRef(new Set<string>());
  const letzteAnfrage = useRef(0);

  const loadShifts = useCallback((year: number, month: number) => {
    const schluessel = `${year}-${month}`;
    if (geladeneMonate.current.has(schluessel)) return;
    geladeneMonate.current.add(schluessel);

    const von = new Date(year, month - 1, 1);
    const bis = new Date(year, month + 2, 0);
    const tage = Math.round((bis.getTime() - von.getTime()) / 86400000) + 1;
    const vonISO = `${von.getFullYear()}-${String(von.getMonth() + 1).padStart(2, "0")}-01`;
    const meine = ++letzteAnfrage.current;

    // my_shift_plan gibt höchstens 62 Tage je Aufruf – in zwei Schritten holen.
    Promise.all([
      fetchMyShiftPlan(vonISO, Math.min(tage, 60)),
      tage > 60 ? fetchMyShiftPlan(addDaysISO(vonISO, 60), tage - 60) : Promise.resolve([]),
    ])
      .then(([a, b]) => {
        if (meine !== letzteAnfrage.current) return;
        setShiftDays((bisher) => {
          const map = new Map(bisher);
          for (const day of [...a, ...b]) {
            map.set(day.date, day.isFree ? null : shiftCode(day.shiftName));
          }
          return map;
        });
      })
      .catch(() => {
        // Nicht geladen heisst: beim naechsten Blick noch einmal versuchen.
        geladeneMonate.current.delete(schluessel);
      });
  }, []);

  useEffect(() => {
    const heute = fromISOLocal(today);
    loadShifts(heute.getFullYear(), heute.getMonth());
  }, [today, loadShifts]);

  // Vorschau der Automatik – zeigt vor dem Absenden, welcher Tag auf
  // welches Konto geht.
  useEffect(() => {
    if (kind !== "auto" || !employeeId || !valid) {
      setAutoDays(null);
      return;
    }
    let cancelled = false;
    fetchAutoPreview(stabil.von, stabil.bis)
      .then((result) => {
        if (!cancelled) setAutoDays(result);
      })
      .catch(() => {
        if (!cancelled) setAutoDays(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, employeeId, stabil, valid]);

  // Empfehlung Urlaub vs. V-Tag – hängt am Starttag, weil sich Zuschläge
  // (Sonntag, Feiertag, Nachtschicht) genau daran entscheiden.
  useEffect(() => {
    if (!employeeId || !valid) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    fetchLeaveKindSuggestion(employeeId, stabil.von)
      .then((result) => {
        if (cancelled) return;
        // Die Empfehlung wird nur angezeigt, nicht übernommen. Vorher
        // stellte sie die Art still von "Automatisch" auf Urlaubstag oder
        // V-Tag um – wer nichts anfasste, beantragte dadurch etwas anderes,
        // als vorausgewählt war. Jetzt bleibt "Automatisch" stehen, bis
        // jemand selbst umstellt.
        setSuggestion(result);
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, stabil, valid]);

  useEffect(() => {
    if (state.success) {
      onSubmitted();
      setReason("");
      // Nach dem Absenden wieder auf "Automatisch" – der nächste Antrag
      // soll nicht die Art des vorigen erben.
      setKind("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const labels = kindLabels[kind];
  const autoUrlaub = (autoDays ?? []).filter((d) => d.kind === "urlaub").length;
  const autoVTage = (autoDays ?? []).filter((d) => d.kind === "v_tag").length;
  const autoOffen = (autoDays ?? []).filter((d) => d.kind === "keins").length;
  /**
   * Wie viele Tage des Zeitraums fallen in welches Kalenderjahr?
   *
   * Ein Antrag über den Jahreswechsel belastet zwei Konten, und jedes
   * muss für seinen eigenen Teil reichen. Für den Normalfall – ein Jahr –
   * ist das genau eine Zeile.
   */
  const tageProJahr = useMemo(() => {
    if (serverTage) return serverTage;
    if (!valid || !holidays) return new Map<number, number>();
    if (startJahr === endJahr) return new Map([[startJahr, days]]);
    const grenze = `${startJahr}-12-31`;
    return new Map([
      [startJahr, previewLeaveDays(startDate, grenze, holidays, null)],
      [endJahr, previewLeaveDays(`${endJahr}-01-01`, endDate, holidays, null)],
    ]);
  }, [serverTage, valid, holidays, startJahr, endJahr, startDate, endDate, days]);

  /** Das Konto des Startjahres – für Anzeige in der Auswahl und im Hinweis. */
  const jahresKonto = konten.get(startJahr) ?? (balance?.year === startJahr ? balance : null);

  /** Das Konto des jeweiligen Jahres, passend zur gewählten Art. */
  const kontoRest = useCallback(
    (jahr: number): number | null => {
      // Beim ersten Rendern liegt das Jahreskonto noch nicht vor. Dann gilt
      // das der Seite, aber nur wenn es dasselbe Jahr ist – sonst lieber
      // nichts anzeigen als eine Zahl aus dem falschen Jahr.
      const konto = konten.get(jahr) ?? (balance?.year === jahr ? balance : null);
      if (kind === "urlaub") return konto?.remainingDays ?? null;
      if (kind === "v_tag") return konto?.vRemainingDays ?? null;
      return null;
    },
    [konten, balance, kind],
  );

  // Urlaub und V-Tage haben je ein Konto, die vier übrigen Arten ein
  // Jahreskontingent. Geprüft wird immer das, was zur gewählten Art gehört –
  // sonst stünde bei einer Altersfreizeit der Urlaubsrest da.
  const accountRemaining =
    kind === "auto"
      ? null
      : kind === "urlaub" || kind === "v_tag"
        ? kontoRest(startJahr)
        : (kontingente.find((q) => q.kind === kind)?.rest ?? null);

  const remainingAfter = accountRemaining !== null ? accountRemaining - (tageProJahr.get(startJahr) ?? days) : null;

  /**
   * Reicht das Konto? Für jedes berührte Jahr einzeln geprüft.
   *
   * Steht das Konto eines Jahres noch nicht zur Verfügung (null), wird
   * nicht blockiert – blockieren würde sonst ein Ladezustand, und die
   * verbindliche Prüfung sitzt ohnehin in decide_leave_request.
   */
  const insufficientBalance = useMemo(() => {
    if (kind === "auto") return false;
    if (kind !== "urlaub" && kind !== "v_tag") {
      return remainingAfter !== null && remainingAfter < 0;
    }
    for (const [jahr, tage] of tageProJahr) {
      const rest = kontoRest(jahr);
      if (rest !== null && rest - tage < 0) return true;
    }
    return false;
  }, [kind, tageProJahr, kontoRest, remainingAfter]);
  const suggestionDiffers =
    suggestion !== null &&
    (suggestion.kind === "urlaub" || suggestion.kind === "v_tag") &&
    suggestion.kind !== kind;
  const staffingCritical = impact !== null && impact.worstStatus === "critical";
  const staffingWarn = impact !== null && impact.worstStatus === "warn";

  let tone: "ok" | "warn" | "critical" = "ok";
  if (insufficientBalance || staffingCritical) tone = "critical";
  else if (staffingWarn || (impact !== null && impact.overlappingEmployees > 0)) tone = "warn";

  const panelTone = {
    ok: "border-ok-bg bg-ok-bg/60 text-ok-fg",
    warn: "border-warn-bg bg-warn-bg/60 text-warn-fg",
    critical: "border-crit-bg bg-crit-bg/60 text-crit-fg",
  }[tone];
  const PanelIcon = tone === "ok" ? CheckCircle2 : TriangleAlert;

  return (
    <Card>
      <CardHeader
        title="Urlaub beantragen"
        hint="Die Anzahl Tage wird verbindlich vom Server berechnet."
      />
      {/* Weniger Rand auf dem Handy – die Breite braucht der Kalender. */}
      <CardBody className="space-y-4 px-3 sm:px-5">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="start_date" value={startDate} />
          <input type="hidden" name="end_date" value={endDate} />
          <input type="hidden" name="kind" value={kind} />

          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink-muted">
              Zeitraum auswählen
            </span>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              minDate={today}
              holidays={holidays ?? []}
              belegt={belegteTage}
              shifts={shiftDays}
              onMonthChange={loadShifts}
              onChange={(newStart, newEnd) => {
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
            />
            <p className="tnum mt-2 text-[13px] text-ink-muted">
              {startDate === endDate
                ? formatDE(startDate)
                : `${formatDE(startDate)} – ${formatDE(endDate)}`}
            </p>

            {gesperrt.length > 0 ? (
              <div className="mt-2">
                <Alert tone="warning">
                  <span className="font-medium">
                    {gesperrt.length === 1
                      ? `Am ${formatDE(gesperrt[0].tag)} gilt eine Urlaubssperre`
                      : `An ${gesperrt.length} Tagen in diesem Zeitraum gilt eine Urlaubssperre`}
                    {sperrGruende.length > 0 ? `: ${sperrGruende.join(", ")}` : ""}.
                  </span>{" "}
                  {gesperrt.length > 1 && gesperrt.length <= 5 ? (
                    <span className="tnum">
                      Betroffen: {gesperrt.map((s) => formatDE(s.tag)).join(", ")}.
                    </span>
                  ) : null}{" "}
                  Du kannst den Antrag trotzdem stellen – die Schichtleitung entscheidet.
                </Alert>
              </div>
            ) : null}
          </div>

          <Field
            label="Art"
            hint="Automatisch heißt: Zuschlagstage kosten Urlaub, der Rest V-Tage."
          >
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as LeaveKind);
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="auto">Automatisch verteilen</option>
              {/* Die Reste gehören zum Jahr des gewählten Zeitraums, nicht
                  zum Jahr der Kontokarte daneben. */}
              <option value="urlaub">
                Urlaubstag
                {jahresKonto
                  ? ` · ${formatDays(jahresKonto.remainingDays)} übrig`
                  : ""}
              </option>
              <option value="v_tag">
                V-Tag
                {jahresKonto
                  ? ` · ${formatDays(jahresKonto.vRemainingDays)} übrig`
                  : ""}
              </option>
              {/* Die vier übrigen Arten kommen nur in die Auswahl, wenn für
                  diese Person etwas übrig ist: bei Bildungsurlaub braucht
                  es den Haken in der Verwaltung, bei Altersfreizeit eine
                  Festlegung. Die Datenbank prüft es noch einmal. */}
              {KONTINGENT_ARTEN.map((art) => {
                const k = kontingente.find((q) => q.kind === art);
                if (!k?.erlaubt) return null;
                return (
                  <option key={art} value={art}>
                    {leaveKindLabels[art]} · {formatDays(Math.max(k.rest, 0))} von{" "}
                    {formatDays(k.anspruch)} übrig
                  </option>
                );
              })}
            </select>
          </Field>

          {suggestion && kind !== "auto" ? (
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-muted px-4 py-3 text-[13px] leading-snug text-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <div>
                <p>
                  <span className="font-medium text-ink">
                    {suggestion.kind === "urlaub"
                      ? "Empfehlung: Urlaubstag"
                      : suggestion.kind === "v_tag"
                        ? "Empfehlung: V-Tag"
                        : "Keine Empfehlung"}
                  </span>{" "}
                  – {suggestion.reason}
                </p>
                {suggestionDiffers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setKind(suggestion.kind as LeaveKind);
                    }}
                    className="mt-1 font-medium text-brand-600 hover:underline"
                  >
                    Empfehlung übernehmen
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Der Kommentar nennt Beispiele, damit klar ist, was hier
              hingehört. Er ändert nichts an der Verrechnung: gebucht wird
              weiterhin das, was oben unter "Art" steht. */}
          <Field label="Kommentar (optional)">
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="z. B. Familienurlaub, Gewerkschaftstag, Sonderurlaub, Bildungsurlaub oder Sonstiges"
              className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
            />
          </Field>

          {kind === "auto" ? (
            <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
              {autoDays === null ? (
                <p className="text-sm text-ink-muted">wird berechnet …</p>
              ) : autoDays.length === 0 ? (
                // Ohne Arbeitstag gibt es nichts zu beantragen. Der Knopf
                // bleibt dann grau, deshalb steht hier auch, warum.
                <p className="text-sm text-ink-muted">
                  In diesem Zeitraum liegt kein Arbeitstag, für den ein Antrag nötig wäre –
                  entweder hast du ohnehin frei, oder die Tage sind bereits beantragt. Wähle
                  einen Zeitraum mit Arbeitstagen.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-sm font-semibold">
                      {autoUrlaub} Urlaubstag{autoUrlaub === 1 ? "" : "e"}
                    </span>
                    <span className="text-sm font-semibold">
                      {autoVTage} V-Tag{autoVTage === 1 ? "" : "e"}
                    </span>
                    {autoOffen > 0 ? (
                      <span className="text-sm font-semibold text-crit-fg">
                        {autoOffen} Tag(e) nicht gedeckt
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-[12px] text-ink-muted">
                    {autoDays.map((day) => (
                      <li key={day.date} className="flex items-baseline justify-between gap-3">
                        <span className="tnum">{formatDE(day.date)}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-ink-faint">{day.reason}</span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                              day.kind === "urlaub"
                                ? "bg-shift-urlaub text-shift-urlaub-ink"
                                : day.kind === "v_tag"
                                  ? "bg-shift-vtag text-shift-vtag-ink"
                                  : "bg-crit-bg text-crit-fg",
                            )}
                          >
                            {day.kind === "urlaub" ? "U" : day.kind === "v_tag" ? "V" : "–"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
              <span className="text-sm text-ink-muted">Benötigte {labels.plural}</span>
              <span className="tnum text-lg font-semibold">
                {zaehltNoch || (!employeeId && !holidays) ? "…" : formatDays(days)}
              </span>
            </div>
          )}

          {valid && kind !== "auto" ? (
            <div className={cn("rounded-xl border px-4 py-3", panelTone)}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PanelIcon className="h-4 w-4" strokeWidth={2} />
                {insufficientBalance
                  ? `Für diesen Zeitraum stehen im Konto ${startJahr} nur noch ${formatDays(Math.max(accountRemaining ?? 0, 0))} ${labels.plural} zur Verfügung.`
                  : staffingCritical
                    ? "Mindestbesetzung wird unterschritten."
                    : `${formatDays(accountRemaining ?? 0)} ${labels.plural} verfügbar${
                      kind === "urlaub" || kind === "v_tag" ? ` (Konto ${startJahr})` : ""
                    }.`}
              </p>
              <ul className="mt-2 space-y-1 text-[13px] leading-snug">
                {remainingAfter !== null && !insufficientBalance ? (
                  <li>
                    {formatDays(remainingAfter)} {labels.plural} verbleiben nach diesem Antrag.
                  </li>
                ) : null}
                {staffingCritical ? (
                  <li>
                    An {impact!.criticalDays === 1 ? "einem Tag" : `${impact!.criticalDays} Tagen`}{" "}
                    würde die Mindestbesetzung deiner Schicht unterschritten.
                  </li>
                ) : staffingWarn ? (
                  <li>Die Besetzung deiner Schicht läge unter der Soll-Stärke, hält aber das Minimum.</li>
                ) : null}
                {impact !== null && impact.overlappingEmployees > 0 ? (
                  <li>
                    Durch diesen Antrag wären {impact.overlappingEmployees + 1} Mitarbeiter deiner
                    Schicht gleichzeitig abwesend.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : !valid ? (
            <Alert tone="error">
              Das Enddatum liegt vor dem Startdatum. Bitte den Zeitraum korrigieren.
            </Alert>
          ) : null}

          {sperrGrund ? <Alert tone="error">{sperrGrund}</Alert> : null}

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <SubmitButton
            label={labels.action}
            disabled={
              Boolean(sperrGrund) ||
              (kind === "auto"
                ? !valid || autoDays === null || autoDays.length === 0 || autoOffen > 0
                : !valid ||
                  zaehltNoch ||
                  // Schweigt der Server, blockiert die Schätzung nicht –
                  // sie kennt die Schichten nicht und läge oft bei 0.
                  (!zaehlFehler && days === 0) ||
                  insufficientBalance)
            }
          />

          {/* Ein ausgegrauter Knopf ohne Begründung ist eine Sackgasse: man
              sieht nur, dass nichts geht. Deshalb steht hier, warum – und
              was stattdessen hilft. */}
          {kind !== "auto" && valid && !zaehltNoch && !zaehlFehler && days === 0 ? (
            <p className="text-[12px] leading-snug text-ink-muted">
              In diesem Zeitraum hast du keine eingeplante Schicht – es gibt nichts zu beantragen.
            </p>
          ) : null}

          {insufficientBalance && kind !== "auto" ? (
            <p className="text-[12px] leading-snug text-crit-fg">
              Absenden nicht möglich: Der Zeitraum braucht mehr {labels.plural}, als im Konto{" "}
              {startJahr} übrig sind. Kürzeren Zeitraum wählen, eine andere Art nehmen oder
              „Automatisch verteilen“ – damit werden Urlaubstage und V-Tage gemischt.
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Wird gesendet …" : label}
    </Button>
  );
}
