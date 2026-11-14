"use client";

import Link from "next/link";
import { MeineDatenKnopf } from "@/components/privacy/meine-daten-knopf";
import { BetreiberLink } from "@/components/layout/betreiber-link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Building2, ChevronRight, KeyRound, LogOut, Repeat, Trash2 } from "lucide-react";
import { wechsleBereich } from "@/lib/bereich";
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
  const { konto, betrieb, schichtarten } = usePrivat();
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

      {/* Ein Login, zwei Bereiche (Migration 0194). */}
      <PrivatKarte titel="Betrieb">
        {betrieb ? (
          <button
            type="button"
            data-zum-betrieb
            onClick={() => wechsleBereich("betrieb", router)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Zum Betrieb wechseln</span>
              <span className="block truncate text-[13px] text-ink-muted">{betrieb.firma}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-ink-faint" />
          </button>
        ) : (
          <Link href="/beitreten" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Einem Betrieb beitreten</span>
              <span className="block text-[13px] text-ink-muted">Mit dem Code aus deinem Betrieb – dein Kalender bleibt.</span>
            </span>
            <ChevronRight className="h-5 w-5 text-ink-faint" />
          </Link>
        )}
      </PrivatKarte>

      <PrivatKarte titel="Kalender">
        <div className="divide-y divide-line">
          <button
            type="button"
            onClick={() => setSchichtfolge(true)}
            disabled={!schichtarten}
            className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-500/12 text-brand-600">
              <Repeat className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Schichtfolge eintragen</span>
              <span className="block truncate text-[12.5px] text-ink-muted">Muster einmal wählen, der Kalender füllt sich</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
          </button>
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">Feiertage anzeigen</span>
              <span className="block text-[12.5px] text-ink-muted">Im Kalender rot hervorgehoben</span>
            </span>
            <input
              type="checkbox"
              checked={konto.feiertageZeigen}
              onChange={(e) => speichere({ feiertageZeigen: e.target.checked })}
              disabled={laeuft}
              className="h-5 w-5 shrink-0 accent-brand-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[15px] font-semibold">Bundesland</span>
            <select
              id="privat-bundesland"
              value={konto.bundesland}
              onChange={(e) => speichere({ bundesland: e.target.value })}
              disabled={laeuft}
              className="max-w-[58%] rounded-xl bg-ink/[0.06] px-3 py-2 text-[14px] font-semibold"
            >
              {BUNDESLAENDER.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <form
            className="px-4 py-3"
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
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="privat-wochenstunden" className="min-w-0">
                <span className="block text-[15px] font-semibold">Wochenstunden</span>
                <span className="block text-[12.5px] text-ink-muted">Für Soll und Überstunden</span>
              </label>
              <div className="flex shrink-0 items-center gap-1.5">
                <input
                  id="privat-wochenstunden"
                  inputMode="decimal"
                  value={stunden}
                  onChange={(e) => setStunden(e.target.value)}
                  placeholder="37,5"
                  className="h-10 w-20 rounded-xl bg-ink/[0.06] px-3 text-right text-[15px] font-semibold outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <button type="submit" disabled={laeuft} className="h-10 rounded-xl bg-brand-500 px-3 text-[13.5px] font-semibold text-white">
                  OK
                </button>
              </div>
            </div>
          </form>
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Mitteilungen & Vorschläge">
        <div className="px-4 py-4">
          <KalenderVorliebenInhalt />
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Profil">
        <div className="space-y-4 px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              speichere({ name });
            }}
          >
            <label htmlFor="privat-name" className="mb-1 block text-[13px] font-semibold text-ink-muted">
              Name
            </label>
            <div className="flex gap-2">
              <input id="privat-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={feld} />
              <button
                type="submit"
                disabled={laeuft || name === konto.name}
                className="shrink-0 rounded-xl bg-brand-500 px-4 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                Speichern
              </button>
            </div>
            <span className="mt-1 block text-[12px] text-ink-faint">Dein Vorname erscheint bei den Leuten, mit denen du teilst.</span>
          </form>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-muted">Darstellung</span>
            <ThemeToggle />
          </div>
        </div>
      </PrivatKarte>

      <PrivatKarte titel="Sicherheit">
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
        <MeineDatenKnopf />
        {/* Nur für Betreiber-Konten sichtbar (z. B. den Notfallzugang, der ein reines Privatkonto ist). */}
        <BetreiberLink className="glas-linie flex w-full items-center gap-3 border-t px-4 py-3.5 text-left text-[15px] font-medium" />
      </PrivatKarte>

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
              <Trash2 className="h-5 w-5" /> {betrieb ? "Privatbereich löschen" : "Konto löschen"}
            </button>
          ) : (
            <form action={loeschAktion} className="space-y-2 px-4 py-4">
              <p className="text-[14px]">
                {betrieb ? (
                  <>
                    Das löscht deinen Privatbereich mit deinen eigenen Schichten und Einstellungen – endgültig. Dein Zugang
                    zum Betrieb bleibt, Termine und To-dos auch (sie gehören zu deinem Login). Gib zur Bestätigung{" "}
                    <b>LÖSCHEN</b> ein.
                  </>
                ) : (
                  <>
                    Das löscht dein Konto mit allen Schichten, Terminen, Partner-Link und Kalender-Abo – endgültig. Gib zur
                    Bestätigung <b>LÖSCHEN</b> ein.
                  </>
                )}
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
export function WiederherstellungsCode() {
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
