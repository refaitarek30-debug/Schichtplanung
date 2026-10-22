"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { registrierePrivat } from "@/lib/privat/actions";
import { pruefeSpitzname } from "@/lib/privat/spitzname";
import type { FormState } from "@/lib/auth/form-state";

const anfang: FormState = {};

/**
 * Privat registrieren auf einer einzigen Seite: Spitzname, Passwort,
 * Datenschutz. Der Spitzname wird schon beim Tippen geprüft, damit ein
 * Fehler dort steht, wo er entsteht – nicht erst nach dem Absenden.
 */
export function PrivatRegistrierung({
  disabled,
  weiter,
  knopf = "Kostenlos starten",
}: {
  disabled?: boolean;
  /** Nach dem Anlegen dorthin (Einladung). */
  weiter?: string;
  knopf?: string;
}) {
  const [state, action, pending] = useActionState(registrierePrivat, anfang);
  const [, startTransition] = useTransition();
  const [spitzname, setSpitzname] = useState("");
  const [beruehrt, setBeruehrt] = useState(false);

  // Zu kurz meldet sich erst nach dem Verlassen des Felds; falsche Zeichen sofort.
  const fehler = spitzname ? pruefeSpitzname(spitzname) : null;
  const zeigeFehler = fehler && (beruehrt || !fehler.includes("mindestens"));

  if (state.success) {
    return (
      <div className="mt-6">
        <Alert tone="success">{state.success}</Alert>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        // Selbst abschicken, damit die Eingaben bei einem Fehler stehen bleiben.
        e.preventDefault();
        setBeruehrt(true);
        if (pruefeSpitzname(spitzname)) return;
        const daten = new FormData(e.currentTarget);
        startTransition(() => action(daten));
      }}
    >
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}

      <Field
        label="Spitzname"
        hint={zeigeFehler ? undefined : "Damit meldest du dich an. 3–24 Zeichen: Buchstaben a–z, Ziffern, Punkt, Unterstrich, Bindestrich."}
        error={zeigeFehler ? fehler : undefined}
      >
        <Input
          name="spitzname"
          value={spitzname}
          onChange={(e) => setSpitzname(e.target.value)}
          onBlur={() => setBeruehrt(true)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
          aria-invalid={zeigeFehler ? true : undefined}
          disabled={disabled}
        />
      </Field>

      <Field label="Passwort" hint="Mindestens 8 Zeichen. Gut merken – es gibt keine Bestätigungsmail.">
        <PasswortInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={disabled} />
      </Field>

      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3">
        <input
          type="checkbox"
          name="datenschutz"
          required
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand-500"
        />
        <span className="text-[13px] leading-snug">
          Ich habe die{" "}
          <Link href="/datenschutz" target="_blank" className="font-medium text-brand-600 hover:underline">
            Datenschutzerklärung
          </Link>{" "}
          gelesen.
        </span>
      </label>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" className="h-11 w-full" disabled={pending || disabled}>
        {pending ? "Wird angelegt …" : knopf}
      </Button>
    </form>
  );
}
