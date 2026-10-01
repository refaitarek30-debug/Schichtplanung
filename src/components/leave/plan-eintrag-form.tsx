"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, GraduationCap, MoreHorizontal, Thermometer } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createAbsence } from "@/lib/auth/absence-actions";
import { assignShiftRange } from "@/lib/auth/rotation-actions";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { TODAY } from "@/lib/demo-data";
import { nachSchichtfolge, schichtFarbe } from "@/lib/shift-style";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Art = "schichtwechsel" | "krank" | "schulung" | "sonstiges";

const ARTEN: { wert: Art; label: string; icon: typeof Thermometer; farbe: string }[] = [
  { wert: "schichtwechsel", label: "Schichtwechsel", icon: ArrowLeftRight, farbe: "" },
  { wert: "krank", label: "Krankheit", icon: Thermometer, farbe: "bg-shift-krank text-shift-krank-ink" },
  { wert: "schulung", label: "Schulung", icon: GraduationCap, farbe: "bg-shift-schulung text-shift-schulung-ink" },
  { wert: "sonstiges", label: "Sonstiges", icon: MoreHorizontal, farbe: "" },
];

const auswahlKnopf =
  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition";

/**
 * Eine Kachel für alles, was den Plan einer Person über einen Zeitraum
 * ändert: Schichtwechsel, Krankheit, Schulung, Sonstiges.
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

  const krank = art === "krank";
  const wechsel = art === "schichtwechsel";
  const vollstaendig = Boolean(mitarbeiter && von && bis && (!wechsel || schicht));

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
        fd.set("type", art);
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
      <CardHeader
        title="Plan ändern"
        hint="Schichtwechsel, Krankheit, Schulung oder Sonstiges – für einen Tag oder einen Zeitraum. Wirkt sich sofort auf die Besetzung aus."
      />
      <CardBody>
        <form onSubmit={speichern} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Mitarbeiter">
              <select
                required
                value={mitarbeiter}
                onChange={(e) => setMitarbeiter(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">auswählen …</option>
                {sortiert.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Von">
              <Input
                type="date"
                required
                value={von}
                min={wechsel ? TODAY : undefined}
                onChange={(e) => {
                  setVon(e.target.value);
                  // Ein Tag ist der Normalfall: das Ende zieht mit.
                  if (!bis || bis < e.target.value) setBis(e.target.value);
                }}
              />
            </Field>
            <Field label="Bis">
              <Input
                type="date"
                required
                min={von || undefined}
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Art</p>
            <div role="radiogroup" aria-label="Art" className="flex flex-wrap gap-1.5">
              {ARTEN.map(({ wert, label, icon: Icon, farbe }) => {
                const aktiv = art === wert;
                return (
                  <button
                    key={wert}
                    type="button"
                    role="radio"
                    aria-checked={aktiv}
                    onClick={() => setArt(wert)}
                    className={cn(
                      auswahlKnopf,
                      aktiv
                        ? cn("border-brand-600 ring-2 ring-brand-500/40", farbe || "bg-brand-50 text-brand-700")
                        : "border-line bg-surface text-ink-muted hover:bg-surface-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {wechsel ? (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Neue Schicht</p>
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
                      className={cn(
                        auswahlKnopf,
                        "min-w-[7.5rem] justify-center",
                        farbe ?? "border-line bg-surface text-ink",
                        farbe && "border-transparent",
                        aktiv
                          ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface"
                          : "opacity-80 hover:opacity-100",
                      )}
                    >
                      {s.name}
                      <span className="tnum text-[11px] font-normal opacity-80">
                        {s.startTime}–{s.endTime}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Tage mit Urlaub oder Abwesenheit bleiben unverändert und werden übersprungen.
              </p>
            </div>
          ) : null}

          <Field
            label="Kommentar (optional)"
            hint={
              krank
                ? "Bei Krankheit wird nur Zeitraum und Status erfasst – kein Kommentar."
                : wechsel
                  ? "Steht als Kommentar am ersten Tag im Plan, für alle sichtbar."
                  : undefined
            }
          >
            <Input
              value={krank ? "" : kommentar}
              disabled={krank}
              maxLength={500}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder={wechsel ? "z. B. Tausch mit Gruppe C" : "z. B. Gefahrgut-Auffrischung"}
            />
          </Field>

          {meldung ? <Alert tone={meldung.ton}>{meldung.text}</Alert> : null}

          <Button type="submit" disabled={sendet || !vollstaendig}>
            {sendet ? "Wird gespeichert …" : wechsel ? "Schicht wechseln" : "Erfassen"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
