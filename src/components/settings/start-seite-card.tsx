"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { STARTSEITEN, type StartSeite } from "@/lib/start-seite";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";

/** Jede Person wählt, was beim Öffnen der App zuerst kommt. */
export function StartSeiteCard() {
  const { profile } = useSession();
  const router = useRouter();
  const [wahl, setWahl] = useState<StartSeite>(profile.startSeite ?? "dashboard");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, start] = useTransition();

  function waehlen(neu: StartSeite) {
    if (neu === wahl) return;
    const vorher = wahl;
    setWahl(neu);
    setFehler(null);
    setGespeichert(false);
    start(async () => {
      const { error } = await createClient()
        .from("profiles")
        .update({ start_seite: neu === "dashboard" ? null : neu })
        .eq("id", profile.id);
      if (error) {
        setWahl(vorher);
        setFehler("Die Auswahl konnte nicht gespeichert werden.");
        return;
      }
      setGespeichert(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Startseite"
        hint="Was soll beim Öffnen der App zuerst kommen? Gilt für dich auf allen Geräten."
      />
      <CardBody className="space-y-2">
        <div role="radiogroup" aria-label="Startseite" className="grid gap-2 sm:grid-cols-3">
          {STARTSEITEN.map((s) => (
            <button
              key={s.wert}
              type="button"
              role="radio"
              aria-checked={wahl === s.wert}
              disabled={laeuft}
              onClick={() => waehlen(s.wert)}
              className={cn(
                "flex items-start justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-colors",
                wahl === s.wert
                  ? "border-brand-600 bg-brand-50"
                  : "border-line bg-surface hover:bg-surface-muted",
              )}
            >
              <span>
                <span className="block text-[15px] font-semibold">{s.label}</span>
                <span className="block text-[13px] text-ink-muted">{s.text}</span>
              </span>
              {wahl === s.wert ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> : null}
            </button>
          ))}
        </div>
        {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}
        {gespeichert && !fehler ? (
          <p className="text-[13px] text-ok-fg">Gespeichert – gilt ab dem nächsten Öffnen.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
