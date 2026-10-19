"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";

/** Passwortfeld mit Auge zum Anzeigen – spart Tippfehler auf dem Handy. */
export function PasswortInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <span className="relative block">
      <Input {...props} type={sichtbar ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setSichtbar((s) => !s)}
        aria-label={sichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={sichtbar}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-faint hover:text-ink-muted disabled:opacity-50"
      >
        {sichtbar ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
      </button>
    </span>
  );
}
