"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Check, CircleCheck, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { updatePassword } from "@/lib/auth/actions";
import { PASSWORT_MIN } from "@/lib/auth/password-policy";
import type { FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";

/**
 * Neues Passwort – so einfach wie möglich: zwei Felder, darunter Häkchen, die
 * beim Tippen grün werden, eine klare Erfolgsmeldung mit „Weiter zur App“ und
 * Hilfe, falls man feststeckt.
 */
export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, {} as FormState);
  const [pw, setPw] = useState("");
  const [wdh, setWdh] = useState("");

  if (state.success) {
    return (
      <div className="mt-6 space-y-4" data-passwort-fertig>
        <div className="flex items-start gap-3 rounded-2xl bg-ok-bg px-4 py-4 text-ok-fg">
          <CircleCheck className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-[16px] font-semibold">{state.success}</p>
            <p className="mt-0.5 text-[14px]">Merk es dir gut. Ab jetzt meldest du dich damit an.</p>
          </div>
        </div>
        {/* Bewusst ein normaler Link: der Browser lädt die App frisch. */}
        <a
          href="/start"
          className="flex h-12 w-full items-center justify-center rounded-full bg-brand-600 text-[16px] font-semibold text-white"
          data-weiter-zur-app
        >
          Weiter zur App
        </a>
      </div>
    );
  }

  const lang = pw.length >= PASSWORT_MIN;
  const gleich = pw.length > 0 && pw === wdh;

  return (
    <>
      <form action={formAction} className="mt-6 space-y-4">
        <Field label="Neues Passwort">
          <PasswortInput
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORT_MIN}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <Field label="Passwort noch einmal">
          <PasswortInput
            name="password_repeat"
            autoComplete="new-password"
            required
            minLength={PASSWORT_MIN}
            value={wdh}
            onChange={(e) => setWdh(e.target.value)}
          />
        </Field>

        <ul className="space-y-1 text-[13.5px]" data-passwort-pruefung>
          <Punkt ok={lang} text={`Mindestens ${PASSWORT_MIN} Zeichen (jetzt: ${pw.length})`} />
          <Punkt ok={gleich} text="Beide Felder sind gleich" />
        </ul>
        <p className="text-[12.5px] leading-snug text-ink-muted">
          Tipp: Drei, vier Wörter, die nichts miteinander zu tun haben, sind sicher und leicht zu merken – zum Beispiel
          „Fahrrad Tomate Wolke 7“.
        </p>

        {state.error ? (
          <Alert tone="error">
            {state.error}
            {state.abgelaufen ? (
              <Link href="/passwort-vergessen" className="mt-2 block font-semibold underline">
                Neuen Code eingeben
              </Link>
            ) : null}
          </Alert>
        ) : null}

        <SubmitButton bereit={lang && gleich} />
      </form>

      <details className="mt-6 rounded-2xl bg-surface-muted px-4 py-3 text-[13.5px] leading-relaxed text-ink-muted" data-passwort-hilfe>
        <summary className="cursor-pointer font-semibold text-ink">Hängst du fest? Hier hilft es weiter</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Das Auge im Feld zeigt dein Passwort an – so siehst du Tippfehler.</li>
          <li>Der Knopf wird erst blau, wenn oben beide Häkchen grün sind.</li>
          <li>
            „Code abgelaufen“? Geh auf{" "}
            <Link href="/passwort-vergessen" className="font-semibold text-brand-600 underline">
              Passwort vergessen
            </Link>{" "}
            und gib einen neuen Code ein.
          </li>
          <li>Keinen Code? Deine Schichtleitung oder Administration gibt dir einen frei.</li>
          <li>Immer noch nicht? Frag deine Schichtleitung – sie kann dir direkt in der App helfen.</li>
        </ol>
      </details>
    </>
  );
}

function Punkt({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-2", ok ? "text-ok-fg" : "text-ink-muted")}>
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", ok ? "bg-ok-bg" : "bg-ink/[0.06]")}>
        {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
      </span>
      {text}
    </li>
  );
}

function SubmitButton({ bereit }: { bereit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-[16px]" disabled={pending || !bereit}>
      {pending ? "Wird gespeichert …" : "Passwort speichern"}
    </Button>
  );
}
