"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { startDemo } from "@/lib/demo/actions";
import type { FormState } from "@/lib/auth/form-state";

/** Knopf „Live-Demo starten“ – legt den Demo-Bereich an und meldet an. */
export function DemoStart() {
  const [state, action] = useActionState(startDemo, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <StartKnopf />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}

function StartKnopf() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? "Demo wird vorbereitet …" : "Live-Demo starten"}
      {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
    </button>
  );
}
