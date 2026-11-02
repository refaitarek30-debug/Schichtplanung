"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { signIn } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/form-state";
import { vergissAenderungsstand } from "@/lib/live-refresh";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import { forgetIdentity } from "@/lib/supabase/identity";
import {
  holeUnlesbareAnmeldung,
  istKeineAntwort,
  merkeAnmeldung,
  merkeUnlesbareAnmeldung,
} from "@/lib/anmelde-aussetzer";
import { safeInternalPath } from "@/lib/security/safe-path";

const initialState: FormState = {};

/**
 * Meldet an. Antwortet der Server dabei nicht lesbar (Aussetzer der
 * Plattform), kann die Anmeldung trotzdem schon durch sein. Deshalb wird sie
 * NICHT noch einmal abgeschickt – das wären zwei Anmeldungen –, sondern die
 * Zielseite direkt geladen. Steht die Sitzung, ist man drin; wenn nicht,
 * landet man wieder hier und bekommt einen Hinweis.
 */
async function anmelden(vorher: FormState, formData: FormData): Promise<FormState> {
  merkeAnmeldung();
  try {
    return await signIn(vorher, formData);
  } catch (fehler) {
    if (!istKeineAntwort(fehler)) throw fehler;
    merkeUnlesbareAnmeldung();
    window.location.assign(safeInternalPath(String(formData.get("weiter") ?? ""), "/start"));
    return {};
  }
}

export function LoginForm({ next, disabled }: { next: string; disabled?: boolean }) {
  const [state, formAction] = useActionState(anmelden, initialState);
  const [ohneAntwort, setOhneAntwort] = useState(false);

  // Wer auf der Anmeldeseite steht, ist abgemeldet – egal auf welchem Weg.
  // Nichts vom vorigen Benutzer soll im Tab übrig bleiben.
  useEffect(() => {
    leereZwischenspeicher();
    forgetIdentity();
    vergissAenderungsstand();
    // Kam man gerade nach einem unlesbaren Server-Aussetzer hierher, hat die
    // Anmeldung nicht geklappt.
    if (holeUnlesbareAnmeldung()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOhneAntwort(true);
    }
  }, []);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="weiter" value={next} />

      <Field label="E-Mail oder Spitzname">
        <Input
          type="text"
          name="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          placeholder="Spitzname oder name@firma.de"
          disabled={disabled}
        />
      </Field>

      <Field label="Passwort">
        <PasswortInput
          name="password"
          autoComplete="current-password"
          required
          disabled={disabled}
        />
      </Field>

      {ohneAntwort && !state.error ? (
        <Alert tone="warning">
          Der Server hat gerade nicht richtig geantwortet. Bitte noch einmal anmelden.
        </Alert>
      ) : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton disabled={disabled} />

      <p className="text-center">
        <Link
          href="/passwort-vergessen"
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Passwort vergessen?
        </Link>
      </p>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Wird geprüft …" : "Einloggen"}
    </Button>
  );
}
