"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** „ABCDE-FGHJK“ – in zwei Hälften liest und tippt es sich leichter. */
export function codeLesbar(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** Ein Passwort-Code groß und zum Kopieren. Er wird nur dieses eine Mal angezeigt. */
export function CodeAnzeige({ code }: { code: string }) {
  const [kopiert, setKopiert] = useState(false);
  const text = codeLesbar(code);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ohne Zwischenablage bleibt der Code markierbar stehen.
      return;
    }
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <output
        aria-label="Code"
        className="tnum flex-1 select-all rounded-xl bg-surface-sunken px-3 py-2.5 text-center font-mono text-[20px] font-bold tracking-[0.14em]"
      >
        {text}
      </output>
      <button
        type="button"
        onClick={() => void kopieren()}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-[14px] font-semibold text-white hover:bg-brand-600"
      >
        {kopiert ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {kopiert ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}
