"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";
import { MyAgeLeaveHint } from "./my-age-leave-hint";

/**
 * Rohe Datenbanktexte gehören nicht auf den Bildschirm: sie nennen Tabellen,
 * Spalten und bei einer RLS-Abweisung den Namen der Richtlinie. Auf einer
 * Seite mit persönlichen Daten erst recht nicht.
 */
function lesbar(err: unknown, ersatz: string): string {
  const bekannt =
    typeof err === "object" && err !== null
      ? dataErrorMessage(err as { message?: string; code?: string })
      : null;
  return bekannt ?? ersatz;
}

export function PersonalDetailsForm({ readOnly }: { readOnly?: boolean }) {
  const [birthDate, setBirthDate] = useState("");
  /**
   * Schon gespeichert? Dann ist das Feld gesperrt: davon hängen Sonderurlaub
   * und Altersfreizeit ab, ändern kann es nur noch die Administration.
   */
  const [festgelegt, setFestgelegt] = useState(false);
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
        if (active) {
          setBirthDate(data?.birth_date ?? "");
          setFestgelegt(Boolean(data?.birth_date));
        }
      } catch (err) {
        if (active) setError(lesbar(err, "Persönliche Angaben konnten nicht geladen werden."));
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
      if (birthDate) setFestgelegt(true);
    } catch (err) {
      setError(lesbar(err, "Speichern fehlgeschlagen."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Persönliche Angaben"
        hint="Freiwillig. Das Geburtsdatum trägst du einmal selbst ein. Ab dem Jahr nach deinem 55. Geburtstag gibt es 4 Tage Sonderurlaub im Jahr."
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
            disabled={readOnly || loading || saving || festgelegt}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1.5 text-[12px] text-ink-faint">
            {festgelegt
              ? "Eingetragen. Ändern kann es nur noch die Administration – davon hängen Sonderurlaub und Altersfreizeit ab."
              : "Keine Pflichtangabe. Bitte genau prüfen: nach dem Speichern kann es nur noch die Administration ändern."}
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <Button
          type="button"
          onClick={() => void save()}
          disabled={readOnly || loading || saving || festgelegt || !birthDate}
        >
          {saving ? "Wird gespeichert …" : "Persönliche Angaben speichern"}
        </Button>

        {readOnly ? (
          <Alert tone="warning">Im Demo-Modus lassen sich keine Änderungen speichern.</Alert>
        ) : (
          <MyAgeLeaveHint key={birthDate} />
        )}
      </CardBody>
    </Card>
  );
}
