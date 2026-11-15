"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { createAbsence } from "@/lib/auth/absence-actions";
import { assignShiftRange } from "@/lib/auth/rotation-actions";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { TODAY } from "@/lib/demo-data";
import { nachSchichtfolge, schichtFarbe } from "@/lib/shift-style";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Art = "schichtwechsel" | "krank" | "schulung" | "berufsschule" | "sonstiges";

const ARTEN: { wert: Art; label: string; farbe: string; nurAzubi?: boolean }[] = [
  { wert: "schichtwechsel", label: "Schicht", farbe: "" },
  { wert: "krank", label: "Krank", farbe: "bg-shift-krank text-shift-krank-ink" },
  { wert: "schulung", label: "Schulung", farbe: "bg-shift-schulung text-shift-schulung-ink" },
  { wert: "berufsschule", label: "Berufsschule", farbe: "bg-[#e0e7ff] text-[#3730a3]", nurAzubi: true },
  { wert: "sonstiges", label: "Sonstiges", farbe: "" },
];

const pille = "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition";
const feld = "h-10 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[14px]";

/**
 * Eine Kachel für alles, was den Plan einer Person über einen Zeitraum
 * ändert: Schichtwechsel, Krankheit, Schulung, Berufsschule (nur Azubis),
 * Sonstiges. Zugeklappt nur eine Zeile, aufgeklappt eine kompakte Zeile je
 * Schritt – ohne lange Erklärungen.
 *
 * Gespeichert wird über die bestehenden Wege – Abwesenheiten über
 * `create_absence_range`, Schichtwechsel über `plan_set_shift` je Tag.
 */
export function PlanEintragForm({
  employees,
  onSaved,
}: {
  employees: EmployeeRecord[];
  onSaved: () => void;
}) {
  const [mitarbeiter, setMitarbeiter] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [art, setArt] = useState<Art>("schichtwechsel");
  const [schicht, setSchicht] = useState("");
  const [kommentar, setKommentar] = useState("");
  const [schichten, setSchichten] = useState<ShiftDetail[]>([]);
  const [meldung, setMeldung] = useState<{ ton: "error" | "success"; text: string } | null>(null);
  const [sendet, startTransition] = useTransition();

  useEffect(() => {
    fetchShiftDetails()
      .then((liste) => setSchichten(nachSchichtfolge(liste.filter((s) => s.active))))
      .catch(() => setSchichten([]));
  }, []);

  const sortiert = useMemo(
    () =>
      [...employees].sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "de"),
      ),
    [employees],
  );

  const person = employees.find((m) => m.id === mitarbeiter);
  const arten = ARTEN.filter((a) => !a.nurAzubi || person?.isApprentice);
  // Wechselt die Person und die Art passt nicht mehr (Berufsschule), zurück auf Schicht.
  const artGilt = arten.some((a) => a.wert === art) ? art : "schichtwechsel";
  const krank = artGilt === "krank";
  const wechsel = artGilt === "schichtwechsel";
  const vollstaendig = Boolean(mitarbeiter && von && bis && (!wechsel || schicht));
  const [offen, setOffen] = useState(false);

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!vollstaendig) return;
    setMeldung(null);
    const fd = new FormData();
    fd.set("employee_id", mitarbeiter);
    fd.set("date_from", von);
    fd.set("date_to", bis);
    if (!krank) fd.set("note", kommentar);
    startTransition(async () => {
      let ergebnis;
      if (wechsel) {
        fd.set("shift_id", schicht);
        ergebnis = await assignShiftRange({}, fd);
      } else {
        fd.set("type", artGilt);
        ergebnis = await createAbsence({}, fd);
      }
      if (ergebnis.error) {
        setMeldung({ ton: "error", text: ergebnis.error });
        return;
      }
      setMeldung({ ton: "success", text: ergebnis.success ?? "Gespeichert." });
      setKommentar("");
      onSaved();
    });
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        data-plan-aendern
      >
        <span className="text-[15px] font-semibold">Plan ändern</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", offen && "rotate-180")} />
      </button>
      {offen ? (
        <CardBody className="border-t border-line pt-3">
          <form onSubmit={speichern} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <select aria-label="Mitarbeiter" required value={mitarbeiter} onChange={(e) => setMitarbeiter(e.target.value)} className={feld}>
                <option value="">Mitarbeiter …</option>
                {sortiert.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
              <input
                aria-label="Von"
                type="date"
                required
                value={von}
                min={wechsel ? TODAY : undefined}
                onChange={(e) => {
                  setVon(e.target.value);
                  // Ein Tag ist der Normalfall: das Ende zieht mit.
                  if (!bis || bis < e.target.value) setBis(e.target.value);
                }}
                className={feld}
              />
              <input aria-label="Bis" type="date" required min={von || undefined} value={bis} onChange={(e) => setBis(e.target.value)} className={feld} />
            </div>

            <div role="radiogroup" aria-label="Art" className="flex flex-wrap gap-1.5">
              {arten.map(({ wert, label, farbe }) => {
                const aktiv = artGilt === wert;
                return (
                  <button
                    key={wert}
                    type="button"
                    role="radio"
                    aria-checked={aktiv}
                    onClick={() => setArt(wert)}
                    className={cn(pille, aktiv ? cn("border-transparent ring-2 ring-brand-500/50", farbe || "bg-brand-50 text-brand-700") : "border-line bg-surface text-ink-muted hover:bg-surface-muted")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {wechsel ? (
              <div role="radiogroup" aria-label="Neue Schicht" className="flex flex-wrap gap-1.5">
                {schichten.map((s) => {
                  const aktiv = schicht === s.id;
                  const farbe = schichtFarbe(s.shortName);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={aktiv}
                      onClick={() => setSchicht(s.id)}
                      title={`${s.startTime}–${s.endTime}`}
                      className={cn(pille, farbe ?? "border-line bg-surface text-ink", farbe && "border-transparent", aktiv ? "ring-2 ring-brand-600 ring-offset-1 ring-offset-surface" : "opacity-80 hover:opacity-100")}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              {krank ? null : (
                <input
                  aria-label="Kommentar"
                  value={kommentar}
                  maxLength={500}
                  onChange={(e) => setKommentar(e.target.value)}
                  placeholder="Kommentar (optional)"
                  className={cn(feld, "sm:flex-1")}
                />
              )}
              <Button type="submit" disabled={sendet || !vollstaendig} className="sm:ml-auto">
                {sendet ? "Speichert …" : "Speichern"}
              </Button>
            </div>

            {meldung ? <Alert tone={meldung.ton}>{meldung.text}</Alert> : null}
          </form>
        </CardBody>
      ) : null}
    </Card>
  );
}
