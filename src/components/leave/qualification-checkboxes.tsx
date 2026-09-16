"use client";

import { useEffect, useState } from "react";
import { fetchQualifications, type QualificationRecord } from "@/lib/data/qualifications";
import { QUALIFICATIONS, qualificationLabels, type Qualification } from "@/lib/qualifications";

/**
 * Mehrfachauswahl der Tätigkeitsqualifikationen. Reines Formularfeld ohne
 * eigenen State – die angehakten Kästchen kommen als `qualifications`
 * (mehrfach im FormData) beim Absenden mit, `formData.getAll("qualifications")`
 * liest sie serverseitig als string[].
 *
 * Die Auswahl stammt seit Migration 0050 aus dem Katalog des Unternehmens,
 * nicht mehr aus einer festen Liste im Programm. Solange der Katalog lädt
 * – oder im Demo-Modus, wo es keinen gibt – stehen die fünf bisherigen
 * Werte als Rückfall da, damit das Formular nie leer wirkt.
 */
export function QualificationCheckboxes({ defaultValues = [] }: { defaultValues?: string[] }) {
  const [katalog, setKatalog] = useState<QualificationRecord[] | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    void fetchQualifications()
      .then((liste) => {
        if (!abgebrochen) setKatalog(liste.filter((q) => q.active));
      })
      // Ein Ladefehler soll das Formular nicht blockieren – dann bleibt
      // der Rückfall stehen, und gespeichert wird trotzdem korrekt.
      .catch(() => {
        if (!abgebrochen) setKatalog(null);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const eintraege =
    katalog && katalog.length > 0
      ? katalog.map((q) => ({ key: q.key, label: q.label }))
      : QUALIFICATIONS.map((q: Qualification) => ({ key: q, label: qualificationLabels[q] }));

  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-medium text-ink-muted">
        Qualifikationen
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {eintraege.map((eintrag) => (
          <label
            key={eintrag.key}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px]"
          >
            <input
              type="checkbox"
              name="qualifications"
              value={eintrag.key}
              defaultChecked={defaultValues.includes(eintrag.key)}
              className="h-4 w-4 rounded border-line accent-brand-500"
            />
            {eintrag.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
