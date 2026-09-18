"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function PersonalDetailsForm({ readOnly }: { readOnly?: boolean }) {
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");

        const { data, error: loadError } = await supabase
          .from("personal_details")
          .select("birth_date")
          .eq("user_id", user.id)
          .maybeSingle();

        if (loadError) throw loadError;
        if (active) setBirthDate(data?.birth_date ?? "");
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Persönliche Angaben konnten nicht geladen werden.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");

      const { error: saveError } = await supabase
        .from("personal_details")
        .update({ birth_date: birthDate || null })
        .eq("user_id", user.id);

      if (saveError) throw saveError;
      setMessage("Persönliche Angaben gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Persönliche Angaben"
        hint="Freiwillig. Das Geburtsdatum kannst nur du selbst hinzufügen, ändern oder wieder löschen."
      />
      <CardBody className="space-y-4">
        <div className="max-w-sm">
          <label htmlFor="birth-date" className="mb-1.5 block text-sm font-medium">
            Geburtsdatum <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="birth-date"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            disabled={readOnly || loading || saving}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1.5 text-[12px] text-ink-faint">
            Keine Pflichtangabe. Wenn du das Feld leer lässt, wird kein Geburtsdatum gespeichert.
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <Button type="button" onClick={() => void save()} disabled={readOnly || loading || saving}>
          {saving ? "Wird gespeichert …" : "Persönliche Angaben speichern"}
        </Button>

        {readOnly ? (
          <Alert tone="warning">Im Demo-Modus lassen sich keine Änderungen speichern.</Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}
