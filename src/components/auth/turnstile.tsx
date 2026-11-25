"use client";

import { useEffect, useRef } from "react";

/**
 * Schutz vor automatischem Passwort-Raten (Cloudflare Turnstile).
 *
 * Supabase prüft bei Anmeldung und Registrierung ein CAPTCHA-Token, sobald dort
 * „CAPTCHA protection“ eingeschaltet ist – auch wenn jemand die Schnittstelle an
 * der App vorbei aufruft. Dieses Feld holt das Token unsichtbar (meist ohne
 * Klick) und legt es als `captcha` ins Formular. Ohne Site Key (Entwicklung,
 * Tests) zeigt es nichts.
 *
 * `neu` = Antwort des Servers (z. B. der Formular-Zustand). Ändert sie sich,
 * holt das Feld ein frisches Token – ein Token gilt nur einmal.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SKRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opt: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let laden: Promise<void> | null = null;
function skriptLaden(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  laden ??= new Promise((ok, fehler) => {
    const s = document.createElement("script");
    s.src = SKRIPT;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      laden = null;
      fehler(new Error("Turnstile nicht erreichbar"));
    };
    document.head.appendChild(s);
  });
  return laden;
}

export const captchaAktiv = SITE_KEY !== "";

export function Turnstile({ neu }: { neu?: unknown }) {
  const feld = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const id = useRef<string | null>(null);
  const vorher = useRef(neu);

  useEffect(() => {
    if (!SITE_KEY) return;
    let weg = false;
    void skriptLaden()
      .then(() => {
        if (weg || !feld.current || !window.turnstile) return;
        id.current = window.turnstile.render(feld.current, {
          sitekey: SITE_KEY,
          language: "de",
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          callback: (t: string) => {
            if (token.current) token.current.value = t;
          },
          "expired-callback": () => {
            if (token.current) token.current.value = "";
          },
          "error-callback": () => {
            if (token.current) token.current.value = "";
          },
        });
      })
      .catch(() => undefined);
    return () => {
      weg = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, []);

  // Nach einem Fehlversuch ein frisches Token holen.
  useEffect(() => {
    if (vorher.current === neu) return;
    vorher.current = neu;
    if (!id.current || !window.turnstile) return;
    if (token.current) token.current.value = "";
    window.turnstile.reset(id.current);
  }, [neu]);

  if (!SITE_KEY) return null;
  return (
    <>
      <input ref={token} type="hidden" name="captcha" defaultValue="" />
      <div ref={feld} data-turnstile className="flex justify-center empty:hidden" />
    </>
  );
}
