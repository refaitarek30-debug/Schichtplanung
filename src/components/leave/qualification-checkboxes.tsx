"use client";

import { QUALIFICATIONS, qualificationLabels, type Qualification } from "@/lib/qualifications";

/**
 * Mehrfachauswahl der Tätigkeitsqualifikationen. Reines Formularfeld ohne
 * eigenen State – die angehakten Checkboxen kommen als `qualifications`
 * (mehrfach im FormData) beim Absenden mit, `formData.getAll("qualifications")`
 * liest sie serverseitig als string[].
 */
export function QualificationCheckboxes({ defaultValues = [] }: { defaultValues?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-medium text-ink-muted">
        Qualifikationen
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUALIFICATIONS.map((q: Qualification) => (
          <label
            key={q}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px]"
          >
            <input
              type="checkbox"
              name="qualifications"
              value={q}
              defaultChecked={defaultValues.includes(q)}
              className="h-4 w-4 rounded border-line accent-brand-500"
            />
            {qualificationLabels[q]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
