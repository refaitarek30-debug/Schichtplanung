"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { SchrittFolge } from "@/components/ui/schritte";
import { registrierePrivat } from "@/lib/privat/actions";
import type { FormState } from "@/lib/auth/form-state";

const anfang: FormState = {};

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

  if (state.success) {
    return (
      <div className="mt-6">
        <Alert tone="success">{state.success}</Alert>
      </div>
    );
  }

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        // Selbst abschicken, damit die Eingaben bei einem Fehler stehen bleiben.
        e.preventDefault();
        const daten = new FormData(e.currentTarget);
        startTransition(() => action(daten));
      }}
    >
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}
      <SchrittFolge
        disabled={disabled}
        schritte={[
          {
            name: "Spitzname",
            frage: "Wie willst du heißen?",
            hinweis: "Damit meldest du dich an. Eine E-Mail-Adresse brauchst du nicht.",
            inhalt: (
              <Field label="Spitzname" hint="3–24 Zeichen: a–z, Ziffern, . _ -">
                <Input
                  name="spitzname"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={24}
                  placeholder="z. B. tarek_nachtschicht"
                  disabled={disabled}
                />
              </Field>
            ),
          },
          {
            name: "Passwort",
            frage: "Wähle ein Passwort",
            hinweis: "Bitte gut merken – es gibt keine Bestätigungsmail. Unter „Mehr“ kannst du dir später einen Wiederherstellungs-Code speichern.",
            inhalt: (
              <Field label="Passwort" hint="mindestens 8 Zeichen">
                <PasswortInput
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  disabled={disabled}
                />
              </Field>
            ),
          },
          {
            name: "Start",
            frage: "Los geht’s",
            hinweis: "Kostenlos, ohne Werbung. Deine Schichten siehst nur du – außer du teilst sie.",
            inhalt: (
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
            ),
          },
        ]}
        meldung={state.error ? <Alert tone="error">{state.error}</Alert> : null}
        abschluss={
          <Button type="submit" className="h-11 w-full" disabled={pending || disabled}>
            {pending ? "Wird angelegt …" : knopf}
          </Button>
        }
      />
    </form>
  );
}

