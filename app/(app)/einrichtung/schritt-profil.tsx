"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { QualificationCheckboxes } from "@/components/leave/qualification-checkboxes";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import { saveOwnSetupProfile } from "@/lib/auth/setup-actions";
import { DataError, fetchOwnProfile, type OwnProfile } from "@/lib/data/setup";
import { useSession } from "@/context/session";

/**
 * Schritt 1 – die eigenen Stammdaten.
 *
 * Wer ein Unternehmen registriert, hat danach einen Personalstammsatz ohne
 * Inhalt: 0 Urlaubstage, 0 V-Tage, keine Abteilung, keine Qualifikation.
 * Das ist Absicht – eine Zahl, die niemand eingegeben hat, sähe aus wie
 * ein gepflegter Wert. Dieser Schritt füllt sie, bevor es an Feiertage,
 * Schichtsystem und Mitarbeiter geht.
 *
 * Die Schichtgruppen A–D liegen im Programm fest, deshalb lässt sich hier
 * schon eine wählen, obwohl das Rotationsmuster erst in Schritt 3
 * entsteht. Die Verknüpfung zum Muster stellt `save_own_setup_profile()`
 * her, sobald eines da ist; kommt das Muster später, zieht Schritt 3 sie
 * über `apply_rotation_to_all()` nach.
 */
export function SchrittProfil({
  onFertig,
}: {
  onFertig: () => void | Promise<void>;
}) {
  const { profile } = useSession();
  const [daten, setDaten] = useState<OwnProfile | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [schichtarbeiter, setSchichtarbeiter] = useState(true);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let abgebrochen = false;
    async function laden() {
      if (!profile.employeeId) {
        setGeladen(true);
        return;
      }
      try {
        const eigene = await fetchOwnProfile(profile.employeeId);
        if (abgebrochen) return;
        setDaten(eigene);
        setSchichtarbeiter(eigene?.shiftWorker ?? true);
      } catch (caught) {
        if (abgebrochen) return;
        setMeldung({
          error:
            caught instanceof DataError
              ? caught.message
              : "Deine Daten konnten nicht geladen werden.",
        });
      } finally {
        if (!abgebrochen) setGeladen(true);
      }
    }
    void laden();
    return () => {
      abgebrochen = true;
    };
  }, [profile.employeeId]);

  function absenden(formData: FormData) {
    setMeldung({});
    startTransition(async () => {
      const result = await saveOwnSetupProfile(formData);
      setMeldung(result);
      if (!result.error) await onFertig();
    });
  }

  if (!geladen) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-muted">wird geladen …</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Schritt 1 · Deine eigenen Angaben"
        hint="Voreingestellt ist nichts – erfundene Zahlen sähen aus wie gepflegte Daten. Alles hier lässt sich später unter Verwaltung ändern."
      />
      <CardBody>
        <form action={absenden} className="space-y-4">
          <p className="text-[13px] text-ink-muted">
            Angemeldet als{" "}
            <span className="font-medium text-ink">
              {profile.firstName} {profile.lastName}
            </span>{" "}
            · Administration
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Abteilung">
              <Input
                name="department"
                defaultValue={daten?.department ?? ""}
                placeholder="z. B. Produktion"
              />
            </Field>
            <Field label="Urlaubsanspruch (Tage/Jahr)">
              <Input
                name="vacation_days"
                type="number"
                step="0.5"
                min="0"
                defaultValue={String(daten?.vacationDays ?? 0)}
              />
            </Field>
            <Field
              label="V-Tage (Freischichten/Jahr)"
              hint="Eigenes Konto neben dem Urlaub. 0, wenn es das bei euch nicht gibt."
            >
              <Input
                name="v_days"
                type="number"
                step="0.5"
                min="0"
                defaultValue={String(daten?.vDays ?? 0)}
              />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input
              type="checkbox"
              name="shift_worker"
              checked={schichtarbeiter}
              onChange={(e) => setSchichtarbeiter(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line accent-brand-500"
            />
            <span className="text-[13px] leading-snug">
              <span className="block font-medium text-ink">Ich arbeite im Schichtsystem</span>
              <span className="text-ink-muted">
                Dann richtet sich dein Urlaub nach dem Schichtplan: auch Samstag und Sonntag
                können Arbeitstage sein, Freitage aus der Rotation kosten keinen Urlaubstag.
                Ohne Haken gilt die Tagschicht – Montag bis Freitag, Wochenende und Feiertage
                frei.
              </span>
            </span>
          </label>

          {/* Nur im Schichtbetrieb sichtbar: eine Schichtgruppe an einer
              Tagschichtkraft ist folgenlos und stiftet nur Verwirrung. Die
              Datenbank verwirft sie in dem Fall ohnehin. */}
          {schichtarbeiter ? (
            <Field
              label="Schichtgruppe"
              hint="Die Gruppen A–D ergeben sich aus dem Rotationsmuster, das du in Schritt 3 festlegst."
            >
              <select
                name="rotation_team"
                defaultValue={daten?.rotationTeam ?? ""}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">noch offen</option>
                {ROTATION_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    Schicht {team}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <QualificationCheckboxes defaultValues={daten?.qualifications ?? []} />

          {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
          {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Wird gespeichert …" : "Angaben speichern"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
