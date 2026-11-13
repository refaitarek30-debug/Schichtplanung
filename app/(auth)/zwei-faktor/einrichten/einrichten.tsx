"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { zweiFaktorBestaetigen, zweiFaktorStarten } from "@/lib/auth/zwei-faktor-actions";

type Start = { factorId?: string; qr?: string; secret?: string; uri?: string; error?: string };

/**
 * Der Schlüssel gilt nur für diesen einen Einrichtungsversuch. Wird die Seite
 * neu geladen (Wechsel in die Authenticator-App, Handy sperrt), muss es
 * derselbe bleiben – sonst passt der gescannte Code nicht mehr. Deshalb merkt
 * sich das Gerät ihn kurz; nach dem Bestätigen wird er sofort gelöscht.
 */
const MERKER = "sn-zwei-faktor-einrichtung";
const MERK_DAUER_MS = 30 * 60 * 1000;

function gemerkt(): (Start & { t: number }) | null {
  try {
    const roh = window.localStorage.getItem(MERKER);
    if (!roh) return null;
    const w = JSON.parse(roh) as Start & { t: number };
    return w.factorId && w.secret && Date.now() - w.t < MERK_DAUER_MS ? w : null;
  } catch {
    return null;
  }
}
function merke(s: Start | null) {
  try {
    if (s) window.localStorage.setItem(MERKER, JSON.stringify({ ...s, t: Date.now() }));
    else window.localStorage.removeItem(MERKER);
  } catch {
    // ohne Speicher: dann eben ein neuer Schlüssel beim Neuladen
  }
}

/** QR-Code scannen, ersten Code eingeben – fertig. */
export function Einrichten({ weiter }: { weiter: string }) {
  const [start, setStart] = useState<Start | null>(null);
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [zeigeSchluessel, setZeigeSchluessel] = useState(false);

  useEffect(() => {
    let weg = false;
    const alt = gemerkt();
    void zweiFaktorStarten(alt?.factorId ?? null).then((s) => {
      if (weg) return;
      if (s.weiter && alt) {
        setStart(alt);
        return;
      }
      if (s.factorId) merke(s);
      setStart(s);
    });
    return () => {
      weg = true;
    };
  }, []);

  async function bestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!start?.factorId) return;
    setLaeuft(true);
    setFehler(null);
    const r = await zweiFaktorBestaetigen(start.factorId, code);
    setLaeuft(false);
    if (r.error) {
      setFehler(r.error);
      return;
    }
    merke(null);
    setFertig(true);
    // Ganz neu laden: die bestätigte Sitzung steckt jetzt im Cookie.
    window.setTimeout(() => window.location.assign(weiter), 1200);
  }

  if (fertig) {
    return (
      <div data-zwei-faktor-fertig className="mt-6 rounded-2xl bg-ok-bg px-4 py-5 text-center">
        <p className="text-[17px] font-bold text-ok-fg">Eingerichtet ✓</p>
        <p className="mt-1 text-[13.5px] text-ink-muted">Ab jetzt fragt ShiftNexo nach dem Passwort noch den Code ab.</p>
      </div>
    );
  }

  if (!start) return <p className="mt-6 text-sm text-ink-muted">Wird vorbereitet …</p>;
  if (start.error) return <Alert tone="error" className="mt-6">{start.error}</Alert>;

  return (
    <div className="mt-6 space-y-5" data-zwei-faktor-einrichten>
      <ol className="space-y-1.5 text-[14px] leading-snug">
        <li>
          <b>1.</b> Authenticator-App aufs Handy laden (Microsoft Authenticator, Google Authenticator oder ähnlich).
        </li>
        <li>
          <b>2.</b> In der App „Konto hinzufügen“ und diesen QR-Code scannen. Bist du auf demselben Handy: den Knopf
          darunter nutzen oder den Schlüssel abtippen.
        </li>
        <li>
          <b>3.</b> Den 6-stelligen Code aus der App unten eingeben.
        </li>
      </ol>

      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={start.qr} alt="QR-Code für die Authenticator-App" width={200} height={200} className="rounded-xl bg-white p-2" />
      </div>
      {start.uri ? (
        <a
          href={start.uri}
          className="block rounded-xl bg-surface-muted px-3 py-2.5 text-center text-[14px] font-semibold text-brand-700"
        >
          Auf diesem Handy? Direkt in der Authenticator-App öffnen
        </a>
      ) : null}
      <div className="text-center">
        {zeigeSchluessel ? (
          <p className="break-all font-mono text-[13px]" data-zwei-faktor-schluessel>
            {start.secret}
          </p>
        ) : (
          <button type="button" onClick={() => setZeigeSchluessel(true)} className="text-[13px] font-semibold text-brand-700">
            QR-Code geht nicht? Schlüssel zum Abtippen zeigen
          </button>
        )}
      </div>

      <form onSubmit={bestaetigen} className="space-y-3">
        <Field label="Code aus der App">
          <Input
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            placeholder="123456"
            className="text-center text-[22px] tracking-[0.3em]"
          />
        </Field>
        {fehler ? <Alert tone="error">{fehler}</Alert> : null}
        <Button type="submit" className="w-full" disabled={laeuft}>
          {laeuft ? "Wird geprüft …" : "Bestätigen und einschalten"}
        </Button>
      </form>
    </div>
  );
}
