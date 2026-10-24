"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { FileUp, KeyRound, LogOut, Repeat, Trash2, Palmtree, CalendarHeart } from "lucide-react";
import { CodeAnzeige } from "@/components/ui/code-anzeige";
import { meinWiederherstellungscode } from "@/lib/auth/passwort-code";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/layout/theme";
import { signOut } from "@/lib/auth/actions";
import { loeschePrivatkonto, speicherePrivatEinstellungen, speicherePrivatEmail } from "@/lib/privat/actions";
import { BUNDESLAENDER } from "@/lib/privat/daten";
import { heuteInBerlin } from "@/lib/dates";
import type { FormState } from "@/lib/auth/form-state";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import { forgetIdentity } from "@/lib/supabase/identity";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf } from "./rahmen";
import { RotationBlatt } from "./rotation";
import { KalenderVorliebenInhalt } from "@/components/kalender/kalender-einstellungen";

/** Einstellungen, Abmelden, Konto löschen. */
export function PrivatMehr() {
  const { konto, schichtarten } = usePrivat();
  const router = useRouter();
  const [name, setName] = useState(konto.name);
  const [stunden, setStunden] = useState(konto.wochenstunden === null ? "" : String(konto.wochenstunden));
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, starte] = useTransition();
  const [loeschen, setLoeschen] = useState(false);
  const [schichtfolge, setSchichtfolge] = useState(false);
  const [loeschStand, loeschAktion] = useActionState(loeschePrivatkonto, {} as FormState);
  const [emailStand, emailAktion, emailLaeuft] = useActionState(speicherePrivatEmail, {} as FormState);

  function speichere(werte: Parameters<typeof speicherePrivatEinstellungen>[0]) {
    setMeldung(null);
    starte(async () => {
      const r = await speicherePrivatEinstellungen(werte);
      if (r.error) setMeldung({ ok: false, text: r.error });
      else {
        setMeldung({ ok: true, text: "Gespeichert." });
        router.refresh();
      }
    });
  }

  const feld = "w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40";

  return (
    <div className="space-y-4">
      <PrivatKopf titel="Mehr" unter="Einstellungen und Konto" />

      <PrivatKarte titel="Mitteilungen & Vorschläge">
        <div className="px-4 py-4">
          <KalenderVorliebenInhalt />
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Kalender">
        <div className="space-y-4 px-4 py-4">
          <button
            type="button"
            onClick={() => setSchichtfolge(true)}
            disabled={!schichtarten}
            className="flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.06] px-3.5 py-3 text-left disabled:opacity-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Repeat className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-medium">Schichtfolge eintragen</span>
              <span className="block text-[13px] text-ink-muted">Muster einmal wählen, der Kalender füllt sich von selbst</span>
            </span>
          </button>
          <Link href="/privat/import" className="flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.06] px-3.5 py-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <FileUp className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-medium">Plan hochladen</span>
              <span className="block text-[13px] text-ink-muted">Screenshot oder Kalender-Datei aus einer anderen App, z. B. Supershift</span>
            </span>
          </Link>
          <Link href="/privat/urlaub" className="flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.06] px-3.5 py-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Palmtree className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-medium">Urlaub clever legen</span>
              <span className="block text-[13px] text-ink-muted">Brückentage finden: viele freie Tage für wenige Urlaubstage</span>
            </span>
          </Link>
          <Link href="/privat/gemeinsam" className="flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.06] px-3.5 py-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <CalendarHeart className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-medium">Gemeinsam frei</span>
              <span className="block text-[13px] text-ink-muted">Wann ihr beide frei habt – Monat und Jahr</span>
            </span>
          </Link>
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[15px] font-medium">Feiertage anzeigen</span>
              <span className="block text-[13px] text-ink-muted">Im Kalender rot hervorgehoben</span>
            </span>
            <input
              type="checkbox"
              checked={konto.feiertageZeigen}
              onChange={(e) => speichere({ feiertageZeigen: e.target.checked })}
              disabled={laeuft}
              className="h-5 w-5 accent-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Bundesland (für die Feiertage)</span>
            <select
              id="privat-bundesland"
              value={konto.bundesland}
              onChange={(e) => speichere({ bundesland: e.target.value })}
              disabled={laeuft}
              className={feld}
            >
              {BUNDESLAENDER.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <form
            className="block"
            onSubmit={(e) => {
              e.preventDefault();
              const t = stunden.trim().replace(",", ".");
              const n = t === "" ? null : Number(t);
              if (n !== null && !(n >= 0 && n <= 80)) {
                setMeldung({ ok: false, text: "Wochenstunden zwischen 0 und 80." });
                return;
              }
              speichere({ wochenstunden: n });
            }}
          >
            <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Wochenstunden laut Vertrag</span>
            <div className="flex gap-2">
              <input
                id="privat-wochenstunden"
                inputMode="decimal"
                value={stunden}
                onChange={(e) => setStunden(e.target.value)}
                placeholder="z. B. 37,5"
                className={feld}
              />
              <button type="submit" disabled={laeuft} className="shrink-0 rounded-xl bg-brand-500 px-4 text-[14px] font-semibold text-white">
                Speichern
              </button>
            </div>
            <span className="mt-1 block text-[12px] text-ink-faint">Für Soll und Überstunden in der Auswertung.</span>
          </form>
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Konto">
        <div className="space-y-4 px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              speichere({ name });
            }}
          >
            <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Name</span>
            <div className="flex gap-2">
              <input id="privat-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={feld} />
              <button type="submit" disabled={laeuft} className="shrink-0 rounded-xl bg-brand-500 px-4 text-[14px] font-semibold text-white">
                Speichern
              </button>
            </div>
            <span className="mt-1 block text-[12px] text-ink-faint">Dein Vorname erscheint in der Partneransicht.</span>
          </form>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-muted">Darstellung</span>
            <ThemeToggle />
          </div>
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Passwort vergessen?">
        <WiederherstellungsCode />
        <form action={emailAktion} className="glas-linie space-y-2 border-t px-4 py-4">
          <p className="text-[13px] text-ink-muted">
            {konto.email
              ? `Hinterlegt: ${konto.email}. Darüber erkennt dich der Support, falls du deinen Code verlierst.`
              : "Freiwillig: Mit einer E-Mail-Adresse erkennt dich der Support leichter, falls du deinen Code verlierst."}
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="du@beispiel.de"
              className={feld}
            />
            <button type="submit" disabled={emailLaeuft} className="shrink-0 rounded-xl bg-brand-500 px-4 text-[14px] font-semibold text-white">
              {konto.email ? "Ändern" : "Speichern"}
            </button>
          </div>
          {emailStand.error ? <Alert tone="error">{emailStand.error}</Alert> : null}
          {emailStand.success ? <Alert tone="success">{emailStand.success}</Alert> : null}
        </form>
      </PrivatKarte>

      {meldung ? <Alert tone={meldung.ok ? "success" : "error"}>{meldung.text}</Alert> : null}

      <PrivatKarte>
        <form
          action={signOut}
          onSubmit={() => {
            leereZwischenspeicher();
            forgetIdentity();
          }}
        >
          <button type="submit" className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium">
            <LogOut className="h-5 w-5 text-ink-muted" /> Abmelden
          </button>
        </form>
        <div className="glas-linie border-t">
          {!loeschen ? (
            <button
              type="button"
              onClick={() => setLoeschen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-crit-fg"
            >
              <Trash2 className="h-5 w-5" /> Konto löschen
            </button>
          ) : (
            <form action={loeschAktion} className="space-y-2 px-4 py-4">
              <p className="text-[14px]">
                Das löscht dein Konto mit allen Schichten, Terminen, Partner-Link und Kalender-Abo – endgültig. Gib zur
                Bestätigung <b>LÖSCHEN</b> ein.
              </p>
              <input id="privat-loeschen" name="bestaetigung" autoComplete="off" className={feld} />
              {loeschStand.error ? <Alert tone="error">{loeschStand.error}</Alert> : null}
              <div className="flex gap-2">
                <button type="submit" className="rounded-xl bg-crit-fg px-4 py-2.5 text-[14px] font-semibold text-white">
                  Endgültig löschen
                </button>
                <button type="button" onClick={() => setLoeschen(false)} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold">
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      </PrivatKarte>

      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-ink-muted">
        <Link href="/datenschutz" className="hover:underline">
          Datenschutz
        </Link>
        <Link href="/impressum" className="hover:underline">
          Impressum
        </Link>
      </p>

      {schichtfolge && schichtarten ? (
        <RotationBlatt
          arten={schichtarten}
          heute={heuteInBerlin()}
          onFertig={() => {
            setSchichtfolge(false);
            router.push("/privat");
          }}
          onClose={() => setSchichtfolge(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Eigener Wiederherstellungs-Code (Migration 0172): einmal erzeugen und
 * aufheben. Gespeichert ist nur ein Prüfwert – der Code selbst steht nur
 * direkt nach dem Erzeugen hier. Ein neuer Code ersetzt den alten.
 */
function WiederherstellungsCode() {
  const [stand, setStand] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, setFrage] = useState(false);
  const [laeuft, starte] = useTransition();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let aktiv = true;
    void Promise.resolve(createClient().rpc("mein_wiederherstellungscode_stand")).then(({ data }) => {
      if (aktiv) setStand(typeof data === "string" ? data : null);
    });
    return () => {
      aktiv = false;
    };
  }, []);

  function erzeugen() {
    setFehler(null);
    setFrage(false);
    starte(async () => {
      const r = await meinWiederherstellungscode();
      if (r.error || !r.code) setFehler(r.error ?? "Der Code ließ sich nicht erzeugen.");
      else {
        setCode(r.code);
        setStand(new Date().toISOString());
      }
    });
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
          <KeyRound className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Wiederherstellungs-Code</p>
          <p className="text-[13px] leading-snug text-ink-muted">
            {stand === undefined
              ? "Wird geprüft …"
              : stand
                ? `Erzeugt am ${new Date(stand).toLocaleDateString("de-DE")}. Damit setzt du unter „Passwort vergessen?“ ein neues Passwort.`
                : "Noch keiner. Erzeuge dir einen und heb ihn gut auf – damit kommst du wieder rein, wenn du dein Passwort vergisst."}
          </p>
        </div>
      </div>
      {code ? (
        <div className="space-y-2">
          <CodeAnzeige code={code} />
          <p className="text-[12.5px] leading-snug text-ink-muted">
            Jetzt speichern, zum Beispiel als Notiz oder Screenshot. Der Code wird nur dieses eine Mal angezeigt und gilt, bis du
            einen neuen erzeugst oder ihn benutzt.
          </p>
        </div>
      ) : frage ? (
        <div className="space-y-2 rounded-[14px] bg-ink/[0.04] p-3">
          <p className="text-[13.5px]">Neuen Code erzeugen? Der bisherige gilt dann nicht mehr.</p>
          <div className="flex gap-2">
            <button type="button" onClick={erzeugen} disabled={laeuft} className="rounded-xl bg-brand-500 px-4 py-2.5 text-[14px] font-semibold text-white">
              Ja, neuer Code
            </button>
            <button type="button" onClick={() => setFrage(false)} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={laeuft || stand === undefined}
          onClick={() => (stand ? setFrage(true) : erzeugen())}
          className="h-11 w-full rounded-[14px] bg-ink text-[15px] font-bold text-surface disabled:opacity-40"
        >
          {laeuft ? "…" : stand ? "Neuen Code erzeugen" : "Code erzeugen"}
        </button>
      )}
      {fehler ? <Alert tone="error">{fehler}</Alert> : null}
    </div>
  );
}
