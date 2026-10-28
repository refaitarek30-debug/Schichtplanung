"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Personalnummer und Abteilung selbst eintragen. Gilt sofort; die
 * Administration kann beides weiterhin ändern, jede Änderung steht im
 * Protokoll (`meine_stammdaten_setzen`).
 */
export function StammdatenForm({
  personalnummer,
  abteilung,
  readOnly,
}: {
  personalnummer: string | null;
  abteilung: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [nr, setNr] = useState(personalnummer ?? "");
  const [ab, setAb] = useState(abteilung ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const geaendert = nr.trim() !== (personalnummer ?? "") || ab.trim() !== (abteilung ?? "");

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { error: fehler } = await createClient().rpc("meine_stammdaten_setzen", {
        p_personalnummer: nr.trim() || null,
        p_abteilung: ab.trim() || null,
      });
      if (fehler) {
        setError(dataErrorMessage(fehler) ?? "Speichern fehlgeschlagen.");
        return;
      }
      setMessage("Gespeichert.");
      // Die Angaben stehen auch in der Sitzung (Kopfleiste, Profil) – neu laden.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Personalnummer und Abteilung" hint="Kannst du selbst eintragen oder ändern. Die Administration sieht es und kann es ebenfalls ändern." />
      <CardBody className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Personalnummer</span>
            <Input value={nr} onChange={(e) => setNr(e.target.value)} maxLength={30} disabled={readOnly || saving} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Abteilung</span>
            <Input value={ab} onChange={(e) => setAb(e.target.value)} maxLength={80} disabled={readOnly || saving} />
          </label>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <Button type="button" onClick={() => void save()} disabled={readOnly || saving || !geaendert}>
          {saving ? "Wird gespeichert …" : "Speichern"}
        </Button>
      </CardBody>
    </Card>
  );
}
