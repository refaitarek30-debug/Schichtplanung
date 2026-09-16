"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { DataError as EmployeeError, fetchEmployees } from "@/lib/data/employees";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import {
  DataError,
  deleteTrainingAssignment,
  fetchTrainingPlan,
  saveTrainingAssignment,
  STATUS_TEXT,
  type TrainingAssignment,
  type TrainingStatus,
} from "@/lib/data/training";
import type { EmployeeRecord } from "@/lib/types";
import { formatDE, monthName } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Ausbildungsplanung.
 *
 * Bewusst getrennt vom Schichtplan: ein Ausbildungsabschnitt ist ein
 * Zeitraum in einem Bereich, keine Tageszuweisung. Wer während eines
 * Abschnitts in einer Schicht mitläuft, bekommt sie hinterlegt – der
 * Schichtplan selbst bleibt unberührt.
 *
 * Die Mitarbeiterdaten kommen aus derselben Quelle wie überall sonst. Es
 * gibt keine zweite Personenverwaltung; wer hier auftaucht, ist unter
 * Verwaltung als Auszubildende oder Auszubildender gekennzeichnet.
 */
export default function AusbildungPage() {
  const { mode, role } = useSession();
  const jetzt = new Date();

  const [jahr, setJahr] = useState(jetzt.getFullYear());
  const [abschnitte, setAbschnitte] = useState<TrainingAssignment[] | null>(null);
  const [azubis, setAzubis] = useState<EmployeeRecord[]>([]);
  const [schichten, setSchichten] = useState<ShiftDetail[]>([]);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [formularOffen, setFormularOffen] = useState(false);
  const [pending, startTransition] = useTransition();

  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;

  const laden = useCallback(async () => {
    if (mode !== "live") return;
    try {
      const [plan, personen, details] = await Promise.all([
        fetchTrainingPlan(von, bis),
        fetchEmployees(),
        fetchShiftDetails(),
      ]);
      setAbschnitte(plan);
      setAzubis(personen.filter((p) => p.isApprentice && p.active));
      setSchichten(details);
    } catch (caught) {
      setAbschnitte([]);
      setMeldung({
        error:
          caught instanceof DataError || caught instanceof EmployeeError
            ? caught.message
            : "Die Ausbildungsplanung konnte nicht geladen werden.",
      });
    }
  }, [mode, von, bis]);

  useEffect(() => {
    void laden();
  }, [laden]);

  function speichern(formData: FormData) {
    setMeldung({});
    startTransition(async () => {
      try {
        await saveTrainingAssignment({
          id: null,
          employeeId: String(formData.get("employee_id") ?? ""),
          start: String(formData.get("start") ?? ""),
          end: String(formData.get("end") ?? ""),
          area: String(formData.get("area") ?? ""),
          shiftId: String(formData.get("shift_id") ?? "") || null,
          note: String(formData.get("note") ?? ""),
          status: (String(formData.get("status") ?? "geplant") as TrainingStatus),
        });
        await laden();
        setFormularOffen(false);
        setMeldung({ success: "Abschnitt gespeichert." });
      } catch (caught) {
        setMeldung({
          error: caught instanceof DataError ? caught.message : "Speichern fehlgeschlagen.",
        });
      }
    });
  }

  function entfernen(id: string) {
    setMeldung({});
    startTransition(async () => {
      try {
        await deleteTrainingAssignment(id);
        await laden();
        setMeldung({ success: "Abschnitt entfernt." });
      } catch (caught) {
        setMeldung({
          error: caught instanceof DataError ? caught.message : "Löschen fehlgeschlagen.",
        });
      }
    });
  }

  // Ein Balken je Abschnitt, waagerecht über die zwölf Monate. Ein
  // Ausbildungsabschnitt dauert Wochen bis Monate – eine Tagesraster
  // wäre auf dem Bildschirm nicht lesbar.
  const proPerson = useMemo(() => {
    const gruppen = new Map<string, { name: string; eintraege: TrainingAssignment[] }>();
    for (const p of azubis) gruppen.set(p.id, { name: `${p.firstName} ${p.lastName}`, eintraege: [] });
    for (const a of abschnitte ?? []) {
      const g = gruppen.get(a.employeeId) ?? { name: a.name, eintraege: [] };
      g.eintraege.push(a);
      gruppen.set(a.employeeId, g);
    }
    return [...gruppen.entries()].map(([id, g]) => ({ id, ...g }));
  }, [azubis, abschnitte]);

  if (mode !== "live") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Führung" title="Ausbildungsplanung" />
        <Alert tone="info">
          Die Ausbildungsplanung arbeitet mit echten Personaldaten und gibt es deshalb nur im
          Live-Modus.
        </Alert>
      </div>
    );
  }

  if (role === "employee") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Führung" title="Ausbildungsplanung" />
        <Alert tone="warning">Für diesen Bereich fehlt dir die Berechtigung.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Ausbildungsplanung"
        description="Abschnitte und Einsätze der Auszubildenden. Getrennt vom Schichtplan – dort ändert sich dadurch nichts."
        action={
          <div className="flex items-center gap-2">
            <select
              value={jahr}
              onChange={(e) => setJahr(Number(e.target.value))}
              aria-label="Jahr"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            >
              {[jetzt.getFullYear() - 1, jetzt.getFullYear(), jetzt.getFullYear() + 1].map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
            <Button onClick={() => setFormularOffen((o) => !o)}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              Abschnitt
            </Button>
          </div>
        }
      />

      {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
      {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

      {formularOffen ? (
        <Card>
          <CardHeader title="Neuer Ausbildungsabschnitt" />
          <CardBody>
            {azubis.length === 0 ? (
              <Alert tone="info">
                Es ist noch niemand als Auszubildende oder Auszubildender gekennzeichnet. Das
                Häkchen dafür steht unter Verwaltung im Mitarbeiterformular.
              </Alert>
            ) : (
              <form action={speichern} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Person">
                    <select
                      name="employee_id"
                      required
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                    >
                      {azubis.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.firstName} {a.lastName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ausbildungsbereich">
                    <Input name="area" required placeholder="z. B. Messwarte" />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Von">
                    <Input name="start" type="date" required defaultValue={`${jahr}-01-01`} />
                  </Field>
                  <Field label="Bis">
                    <Input name="end" type="date" required defaultValue={`${jahr}-01-31`} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Schicht" hint="Leer, wenn der Abschnitt keiner Schicht zugeordnet ist.">
                    <select
                      name="shift_id"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                    >
                      <option value="">keine</option>
                      {schichten.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      name="status"
                      defaultValue="geplant"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                    >
                      {(Object.keys(STATUS_TEXT) as TrainingStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_TEXT[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Bemerkung">
                  <Input name="note" placeholder="optional" />
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? "Wird gespeichert …" : "Speichern"}
                  </Button>
                  <Button variant="secondary" onClick={() => setFormularOffen(false)}>
                    Abbrechen
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={`Jahresübersicht ${jahr}`}
          hint="Ein Balken je Abschnitt. Ein Ausbildungsabschnitt dauert Wochen bis Monate – ein Tagesraster wäre auf dem Bildschirm nicht lesbar."
        />
        <CardBody className="px-0 sm:px-0">
          {abschnitte === null ? (
            <p className="px-4 text-sm text-ink-muted sm:px-5">wird geladen …</p>
          ) : proPerson.length === 0 ? (
            <div className="px-4 sm:px-5">
              <EmptyState title="Noch keine Auszubildenden gekennzeichnet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] px-4 sm:px-5">
                <div className="mb-1 flex gap-1 pl-[140px]">
                  {Array.from({ length: 12 }, (_, i) => monthName(i)).map((m) => (
                    <span
                      key={m}
                      className="flex-1 text-center text-[10px] uppercase tracking-wide text-ink-faint"
                    >
                      {m.slice(0, 3)}
                    </span>
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {proPerson.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <span className="w-[132px] shrink-0 truncate text-[13px] font-medium">
                        {p.name}
                      </span>
                      <span className="relative flex h-8 flex-1 items-center rounded-lg bg-surface-muted">
                        {p.eintraege.map((a) => {
                          const start = new Date(a.startDate);
                          const ende = new Date(a.endDate);
                          const jahrStart = new Date(`${jahr}-01-01`).getTime();
                          const jahrTage = 365;
                          const linksTag = Math.max(
                            0,
                            (start.getTime() - jahrStart) / 86400000,
                          );
                          const tage = Math.max(
                            1,
                            (ende.getTime() - Math.max(start.getTime(), jahrStart)) / 86400000 + 1,
                          );
                          return (
                            <span
                              key={a.id}
                              title={`${a.area} · ${formatDE(a.startDate)}–${formatDE(a.endDate)}${
                                a.shiftName ? ` · ${a.shiftName}` : ""
                              }${a.abwesendTage > 0 ? ` · ${a.abwesendTage} Tage abwesend` : ""}`}
                              style={{
                                left: `${(linksTag / jahrTage) * 100}%`,
                                width: `${Math.min((tage / jahrTage) * 100, 100)}%`,
                              }}
                              className={cn(
                                "absolute flex h-6 items-center overflow-hidden rounded px-1.5 text-[11px] text-white",
                                a.status === "abgeschlossen"
                                  ? "bg-ok-fg/70"
                                  : a.status === "abgebrochen"
                                    ? "bg-ink-faint"
                                    : a.status === "laeuft"
                                      ? "bg-brand-500"
                                      : "bg-brand-500/60",
                              )}
                            >
                              <span className="truncate">{a.area}</span>
                            </span>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {(abschnitte?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader title="Abschnitte" />
          <CardBody className="space-y-2">
            {abschnitte?.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {a.name} · {a.area}
                  </p>
                  <p className="tnum mt-0.5 text-[12px] text-ink-muted">
                    {formatDE(a.startDate)} – {formatDE(a.endDate)}
                    {a.shiftName ? ` · ${a.shiftName}` : ""}
                    {a.abwesendTage > 0 ? ` · ${a.abwesendTage} Tage abwesend` : ""}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.status === "abgeschlossen" ? "ok" : "info"}>
                    {STATUS_TEXT[a.status]}
                  </Badge>
                  <Button variant="secondary" disabled={pending} onClick={() => entfernen(a.id)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
