"use client";

import { useState, useTransition } from "react";
import { Trash2, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  firmaEndgueltig,
  firmaZurueckholen,
  firmenInPapierkorb,
  privatkontenLoeschen,
  type LoeschErgebnis,
} from "./loeschen-aktionen";

export interface LoeschFirma {
  id: string;
  name: string;
  angelegt_am: string;
  geloescht_am: string | null;
  endgueltig_am: string | null;
  mitarbeiter: number;
  zugaenge: number;
  plan_eintraege: number;
  urlaubsantraege: number;
  betreiber: boolean;
}

export interface LoeschPrivat {
  user_id: string;
  name: string;
  erstellt_am: string;
  letzter_login: string | null;
  betreiber: boolean;
}

export interface LoeschListe {
  firmen: LoeschFirma[];
  privat: LoeschPrivat[];
}

const datum = (w: string | null) => (w ? new Date(w).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");

function resttage(endgueltig: string | null): string {
  if (!endgueltig) return "";
  const tage = Math.ceil((new Date(endgueltig).getTime() - Date.now()) / 86_400_000);
  if (tage <= 0) return "wird heute Nacht gelöscht";
  return tage === 1 ? "noch 1 Tag" : `noch ${tage} Tage`;
}

type Frage =
  | { art: "firmen"; ids: string[]; text: string }
  | { art: "privat"; ids: string[]; text: string }
  | { art: "endgueltig"; ids: string[]; text: string };

/**
 * Löschen: Firmen kommen 14 Tage in den Papierkorb (Zugänge gesperrt, alles
 * lässt sich zurückholen), Privatkonten werden sofort gelöscht. Vor jeder
 * Aktion muss LÖSCHEN eingetippen werden.
 */
export function LoeschBereich({ liste }: { liste: LoeschListe }) {
  const [firmenAuswahl, setFirmenAuswahl] = useState<Set<string>>(new Set());
  const [privatAuswahl, setPrivatAuswahl] = useState<Set<string>>(new Set());
  const [frage, setFrage] = useState<Frage | null>(null);
  const [wort, setWort] = useState("");
  const [antwort, setAntwort] = useState<LoeschErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const aktive = liste.firmen.filter((f) => !f.geloescht_am);
  const papierkorb = liste.firmen.filter((f) => f.geloescht_am);

  function umschalten(menge: Set<string>, setze: (s: Set<string>) => void, id: string) {
    const neu = new Set(menge);
    if (neu.has(id)) neu.delete(id);
    else neu.add(id);
    setze(neu);
  }

  function bestaetigen() {
    if (!frage) return;
    const f = frage;
    starte(async () => {
      const r =
        f.art === "firmen"
          ? await firmenInPapierkorb(f.ids, wort)
          : f.art === "privat"
            ? await privatkontenLoeschen(f.ids, wort)
            : await firmaEndgueltig(f.ids[0], wort);
      setAntwort(r);
      if (!r.fehler || r.ok || /gelegt|gelöscht/.test(r.fehler)) {
        setFirmenAuswahl(new Set());
        setPrivatAuswahl(new Set());
      }
      setFrage(null);
      setWort("");
    });
  }

  function holeZurueck(id: string) {
    starte(async () => setAntwort(await firmaZurueckholen(id)));
  }

  const gewaehlteFirmen = aktive.filter((f) => firmenAuswahl.has(f.id));
  const gewaehltePrivat = liste.privat.filter((p) => privatAuswahl.has(p.user_id));

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Löschen</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Firmen liegen erst 14 Tage im Papierkorb: die Zugänge sind gesperrt, die Daten bleiben und lassen sich zurückholen.
          Danach löscht ein nächtlicher Job alles endgültig. Privatkonten werden sofort gelöscht. Die Demo und dein eigenes Konto
          kannst du nicht auswählen.
        </p>
      </header>

      {antwort?.ok ? <Alert tone="success">{antwort.ok}</Alert> : null}
      {antwort?.fehler ? <Alert tone="error">{antwort.fehler}</Alert> : null}

      <Card>
        <CardHeader title="Firmen" hint={`${aktive.length} aktiv`} />
        <CardBody className="space-y-2">
          {aktive.length === 0 ? <p className="text-sm text-ink-muted">Keine Firmen.</p> : null}
          {aktive.map((f) => (
            <label key={f.id} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-500"
                checked={firmenAuswahl.has(f.id)}
                disabled={f.betreiber}
                onChange={() => umschalten(firmenAuswahl, setFirmenAuswahl, f.id)}
              />
              <span className="min-w-0 text-sm">
                <span className="font-semibold">{f.name}</span>
                {f.betreiber ? <span className="ml-2 text-xs text-ink-faint">(enthält Betreiber-Konto, geschützt)</span> : null}
                <span className="block text-[12.5px] text-ink-muted">
                  angelegt {datum(f.angelegt_am)} · {f.mitarbeiter} Mitarbeiter · {f.zugaenge} Zugänge · {f.plan_eintraege} Planeinträge ·{" "}
                  {f.urlaubsantraege} Anträge
                </span>
              </span>
            </label>
          ))}
          <button
            type="button"
            disabled={gewaehlteFirmen.length === 0 || laeuft}
            onClick={() =>
              setFrage({
                art: "firmen",
                ids: gewaehlteFirmen.map((f) => f.id),
                text: `${gewaehlteFirmen.length === 1 ? `Die Firma „${gewaehlteFirmen[0].name}“` : `${gewaehlteFirmen.length} Firmen`} in den Papierkorb legen? Zugänge werden gesperrt, nach 14 Tagen ist alles endgültig weg.`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-crit-fg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Ausgewählte in den Papierkorb
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Papierkorb" hint={papierkorb.length === 1 ? "1 Firma" : `${papierkorb.length} Firmen`} />
        <CardBody className="space-y-2">
          {papierkorb.length === 0 ? <p className="text-sm text-ink-muted">Der Papierkorb ist leer.</p> : null}
          {papierkorb.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{f.name}</span>
                <span className="block text-[12.5px] text-ink-muted">
                  gelöscht am {datum(f.geloescht_am)} · endgültig am {datum(f.endgueltig_am)} ({resttage(f.endgueltig_am)}) · {f.mitarbeiter}{" "}
                  Mitarbeiter
                </span>
              </span>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => holeZurueck(f.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
              >
                <Undo2 className="h-4 w-4" /> Zurückholen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  setFrage({ art: "endgueltig", ids: [f.id], text: `„${f.name}“ jetzt sofort endgültig löschen? Das lässt sich nicht mehr rückgängig machen.` })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-crit-fg px-3 py-2 text-sm font-semibold text-white"
              >
                <Trash2 className="h-4 w-4" /> Jetzt endgültig
              </button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Privatkonten" hint={`${liste.privat.length} (neueste 500)`} />
        <CardBody className="space-y-2">
          {liste.privat.length === 0 ? <p className="text-sm text-ink-muted">Keine Privatkonten.</p> : null}
          <div className="max-h-96 space-y-1.5 overflow-y-auto">
            {liste.privat.map((p) => (
              <label key={p.user_id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-500"
                  checked={privatAuswahl.has(p.user_id)}
                  disabled={p.betreiber}
                  onChange={() => umschalten(privatAuswahl, setPrivatAuswahl, p.user_id)}
                />
                <span className="min-w-0 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="ml-2 text-[12.5px] text-ink-muted">
                    seit {datum(p.erstellt_am)} · zuletzt {datum(p.letzter_login)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={gewaehltePrivat.length === 0 || laeuft}
            onClick={() =>
              setFrage({
                art: "privat",
                ids: gewaehltePrivat.map((p) => p.user_id),
                text: `${gewaehltePrivat.length === 1 ? `Das Konto „${gewaehltePrivat[0].name}“` : `${gewaehltePrivat.length} Privatkonten`} sofort und endgültig löschen, mit allen Einträgen?`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-crit-fg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Ausgewählte löschen
          </button>
        </CardBody>
      </Card>

      {frage ? (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Bist du sicher?</h3>
            <p className="text-sm leading-relaxed">{frage.text}</p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-muted">
                Zur Bestätigung <b>LÖSCHEN</b> eintippen
              </span>
              <input
                value={wort}
                onChange={(e) => setWort(e.target.value)}
                autoFocus
                autoComplete="off"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFrage(null);
                  setWort("");
                }}
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-muted"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={wort.trim().toUpperCase() !== "LÖSCHEN" || laeuft}
                onClick={bestaetigen}
                className="rounded-xl bg-crit-fg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {laeuft ? "…" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
