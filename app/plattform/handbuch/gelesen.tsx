"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const SCHLUESSEL = "konsole-handbuch-gelesen";
const EREIGNIS = "handbuch-gelesen";

function lesen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Haken „gelesen“ je Kapitel – nur auf diesem Gerät gemerkt. */
export function Gelesen({ id, nurPunkt = false }: { id: string; nurPunkt?: boolean }) {
  const [an, setAn] = useState(false);
  useEffect(() => {
    const neu = () => setAn(lesen().includes(id));
    neu();
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, [id]);

  if (nurPunkt) {
    return (
      <span
        aria-hidden
        className={`grid size-4 shrink-0 place-items-center rounded-full border ${an ? "border-ok-fg bg-ok-fg text-white" : "border-line"}`}
      >
        {an ? <Check className="size-3" /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={an}
      data-gelesen={id}
      onClick={() => {
        const liste = lesen().filter((x) => x !== id);
        if (!an) liste.push(id);
        try {
          localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
        } catch {
          /* ohne Speicher: nur für jetzt */
        }
        setAn(!an);
        window.dispatchEvent(new Event(EREIGNIS));
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium ${an ? "border-ok-fg bg-ok-fg/10 text-ok-fg" : "border-line hover:bg-surface-muted"}`}
    >
      <Check className="size-4" />
      {an ? "Gelesen" : "Als gelesen abhaken"}
    </button>
  );
}
