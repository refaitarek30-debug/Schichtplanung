"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addDays, formatDE, formatDays, SCHICHT_STUNDEN } from "@/lib/dates";
import { fetchEmployees } from "@/lib/data/employees";
import { DataError, fetchFehlzeiten, type Fehlzeit, type FehlzeitArt } from "@/lib/data/fehlzeiten";
import { deleteFehlzeit, saveFehlzeit } from "@/lib/auth/fehlzeit-actions";
import { useAktualisierung } from "@/lib/live-refresh";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Auswahl in Viertelstunden: 0,25 … 7,75 Std. */
const STUNDEN = Array.from({ length: 31 }, (_, i) => (i + 1) / 4);

const ART_TEXT: Record<FehlzeitArt, string> = {
  frueher_gegangen: "früher gegangen",
  spaeter_gekommen: "später gekommen",
};

/** AF-Satz je voller Schicht – wie in der Datenbank (stundenkonto). */
const AF_SATZ = 0.82;

/**
 * Früher gegangen / später gekommen – für die Schichtleitung auf der
 * Startseite unter dem Schichtplan.
 *
 * Grundlage ist eine Schicht von 8 Stunden. Die fehlenden Stunden gehen
 * anteilig von den V-Tagen ab (2 Std. = 0,25 V-Tage), und die
 * Altersfreizeit wird für den Tag nur anteilig angespart (6 von 8 Std. =
 * 0,82 × 6/8). Gerechnet wird in der Datenbank; hier wird nur eingetragen.
 *
 * Die Schichtleitung sieht die Personen ihrer eigenen Schicht, die
 * Administration wählt die Schicht oben aus.
 */
export function FehlzeitenLeiste({
  heute,
  istAdmin,
  eigeneEmployeeId,
}: {
  heute: string;
  istAdmin: boolean;
  eigeneEmployeeId: string | null;
}) {
  const [mitarbeiter, setMitarbeiter] = useState<EmployeeRecord[]>([]);
  const [eintraege, setEintraege] = useState<Fehlzeit[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [gruppe, setGruppe] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [tag, setTag] = useState(heute);
  const [art, setArt] = useState<FehlzeitArt>("frueher_gegangen");
  const [stunden, setStunden] = useState(2);
  const [notiz, setNotiz] = useState("");

  const laden = useCallback(async () => {
    try {
      const [liste, fz] = await Promise.all([
        fetchEmployees(),
        fetchFehlzeiten(addDays(heute, -60), addDays(heute, 60)),
      ]);
      setMitarbeiter(liste.filter((e) => e.active));
      setEintraege(fz);
    } catch (caught) {
      setEintraege([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Fehlzeiten konnten nicht geladen werden.",
      );
    }
  }, [heute]);

  useEffect(() => {
    void laden();
  }, [laden]);

  useAktualisierung(["abwesenheiten", "plan"], () => void laden());

  const eigeneGruppe = useMemo(
    () => mitarbeiter.find((e) => e.id === eigeneEmployeeId)?.rotationTeam ?? null,
    [mitarbeiter, eigeneEmployeeId],
  );

  /** Schichtgruppen für die Administration: A–D, dann Tagschicht. */
  const gruppen = useMemo(() => {
    const set = new Set<string>();
    for (const e of mitarbeiter) set.add(e.rotationTeam ?? "");
    return [...set].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [mitarbeiter]);

  // Die Schichtleitung arbeitet in ihrer eigenen Gruppe, die
  // Administration beginnt dort, wo sie selbst steht – oder bei der ersten.
  const aktiveGruppe = istAdmin ? (gruppe ?? eigeneGruppe ?? gruppen[0] ?? "") : (eigeneGruppe ?? "");

  const auswahl = useMemo(
    () =>
      mitarbeiter
        .filter((e) => (e.rotationTeam ?? "") === aktiveGruppe)
        .sort((a, b) => a.lastName.localeCompare(b.lastName, "de")),
    [mitarbeiter, aktiveGruppe],
  );

  const gewaehlt = auswahl.find((e) => e.id === person) ?? null;
  const vTage = stunden / SCHICHT_STUNDEN;
  const afAnteil = (AF_SATZ * (SCHICHT_STUNDEN - stunden)) / SCHICHT_STUNDEN;

  function speichern() {
    if (!gewaehlt) {
      setFehler("Bitte zuerst eine Person auswählen.");
      return;
    }
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const result = await saveFehlzeit(gewaehlt.id, tag, art, stunden, notiz);
      if (result.error) {
        setFehler(result.error);
        return;
      }
      setMeldung(
        `${gewaehlt.firstName} ${gewaehlt.lastName}: ${formatDays(stunden)} Std. ${ART_TEXT[art]} am ${formatDE(tag)} – ${formatDays(vTage)} V-Tage abgezogen.`,
      );
      setNotiz("");
      await laden();
    });
  }

  function loeschen(id: string) {
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const result = await deleteFehlzeit(id);
      if (result.error) {
        setFehler(result.error);
        return;
      }
      await laden();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Früher gegangen / später gekommen"
        hint="Fehlende Stunden einer 8-Std.-Schicht gehen anteilig von den V-Tagen ab. Die Altersfreizeit wird für den Tag nur anteilig angespart."
      />
      <div className="space-y-3 px-4 py-3 sm:px-5">
        {istAdmin && gruppen.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Schicht auswählen">
            {gruppen.map((g) => (
              <button
                key={g || "tag"}
                type="button"
                onClick={() => {
                  setGruppe(g);
                  setPerson(null);
                }}
                aria-pressed={aktiveGruppe === g}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  aktiveGruppe === g
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-muted hover:bg-surface-muted",
                )}
              >
                {g ? `Schicht ${g}` : "Tagschicht"}
              </button>
            ))}
          </div>
        ) : null}

        {/* Die Leiste mit den Personen der Schicht: ein Tipp wählt aus.
            Auf dem Handy seitlich wischbar statt vieler Zeilen. */}
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Mitarbeiter auswählen"
        >
          {auswahl.length === 0 ? (
            <p className="text-[12px] text-ink-muted">
              {mitarbeiter.length === 0 ? "Wird geladen …" : "Keine Personen in dieser Schicht."}
            </p>
          ) : (
            auswahl.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setPerson(e.id)}
                aria-pressed={person === e.id}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors",
                  person === e.id
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : "border-line bg-surface hover:bg-surface-muted",
                )}
              >
                {e.firstName} {e.lastName}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
            Tag
            <input
              type="date"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[16px] text-ink sm:text-[13px]"
            />
          </label>
          <div className="flex flex-col gap-1 text-[12px] text-ink-muted">
            Was
            <div className="flex overflow-hidden rounded-lg border border-line" role="group">
              {(Object.keys(ART_TEXT) as FehlzeitArt[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArt(a)}
                  aria-pressed={art === a}
                  className={cn(
                    "px-2.5 py-1.5 text-[13px] transition-colors",
                    art === a ? "bg-brand-600 font-semibold text-white" : "bg-surface text-ink hover:bg-surface-muted",
                  )}
                >
                  {a === "frueher_gegangen" ? "Früher gegangen" : "Später gekommen"}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
            Stunden
            <select
              value={stunden}
              onChange={(e) => setStunden(Number(e.target.value))}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[16px] text-ink sm:text-[13px]"
            >
              {STUNDEN.map((h) => (
                <option key={h} value={h}>
                  {formatDays(h)} Std.
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[12px] text-ink-muted">
            Notiz (optional)
            <input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              maxLength={200}
              placeholder="z. B. Arzttermin"
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[16px] text-ink sm:text-[13px]"
            />
          </label>
        </div>

        {/* Vorschau, was die Eintragung bewirkt – bevor gespeichert wird. */}
        <p className="tnum rounded-lg bg-surface-muted px-3 py-2 text-[12px] text-ink-muted">
          {gewaehlt ? (
            <>
              <span className="font-medium text-ink">
                {gewaehlt.firstName} {gewaehlt.lastName}
              </span>{" "}
              · {formatDE(tag)} · {formatDays(stunden)} Std. {ART_TEXT[art]} →{" "}
            </>
          ) : (
            "Person auswählen · "
          )}
          <span className="font-medium text-ink">−{formatDays(vTage)} V-Tage</span> ({formatDays(stunden)} Std.) ·
          Altersfreizeit für den Tag {formatDays(Math.round(afAnteil * 100) / 100)} statt 0,82 Std.
        </p>

        {fehler ? <Alert tone="error">{fehler}</Alert> : null}
        {meldung ? <Alert tone="success">{meldung}</Alert> : null}

        <Button disabled={pending || !gewaehlt} onClick={speichern}>
          <Clock className="h-4 w-4" strokeWidth={2} />
          {pending ? "Wird gespeichert …" : "Fehlzeit eintragen"}
        </Button>

        {eintraege && eintraege.length > 0 ? (
          <div className="border-t border-line pt-2">
            <p className="mb-1 text-[12px] font-medium text-ink-muted">Eingetragen (letzte 60 Tage)</p>
            <ul className="divide-y divide-line text-[13px]">
              {eintraege.map((f) => (
                <li key={f.id} className="flex items-center gap-2 py-1.5">
                  <span className="tnum w-[5.5rem] shrink-0 text-ink-muted">{formatDE(f.tag)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{f.employeeName}</span>{" "}
                    <span className="text-ink-muted">
                      · {formatDays(f.stunden)} Std. {ART_TEXT[f.art]}
                      {f.notiz ? ` · ${f.notiz}` : ""}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[12px] text-ink-muted">
                    −{formatDays(f.stunden / SCHICHT_STUNDEN)} V
                  </span>
                  {f.darfAendern ? (
                    <button
                      type="button"
                      onClick={() => loeschen(f.id)}
                      disabled={pending}
                      aria-label={`Fehlzeit von ${f.employeeName} am ${formatDE(f.tag)} löschen`}
                      className="shrink-0 rounded p-1 text-ink-faint hover:bg-surface-muted hover:text-crit-fg disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
