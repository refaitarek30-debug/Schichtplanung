"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "schichtplan.install-hint";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function alreadyDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Privater Modus o. Ä. – dann erscheint der Hinweis eben wieder.
  }
}

/**
 * Hinweis, dass sich der Schichtplan als App installieren lässt.
 *
 * Android/Chrome liefert dafür ein eigenes Ereignis, das wir abfangen und
 * über einen Knopf auslösen. iOS kennt das nicht – dort steht nur der Weg
 * über "Teilen → Zum Home-Bildschirm".
 */
export function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (alreadyDismissed()) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    remember();
    setPromptEvent(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    close();
  }

  if (!promptEvent && !showIosHint) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-brand-50 px-4 py-3">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="font-medium text-ink">Schichtplan als App installieren</p>
        {promptEvent ? (
          <button
            type="button"
            onClick={install}
            className="mt-1 font-medium text-brand-600 hover:underline"
          >
            Jetzt installieren
          </button>
        ) : (
          <p className="text-ink-muted">
            In Safari unten auf <Share className="inline h-3.5 w-3.5 align-[-2px]" /> Teilen tippen
            und dann „Zum Home-Bildschirm“ wählen.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Hinweis ausblenden"
        className="shrink-0 rounded-lg p-1 text-ink-faint hover:bg-surface-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
