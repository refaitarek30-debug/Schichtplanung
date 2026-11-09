"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Lock, Trash2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { heuteInBerlin, monthName } from "@/lib/dates";
import {
  ansehenLink,
  einwilligungStand,
  groesseText,
  hochladen,
  ladeLohnzettel,
  loeschen,
  setzeEinwilligung,
  type Lohnzettel,
} from "@/lib/privat/lohnzettel";
import { ladeGehaltEinstellungen } from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { usePrivat } from "./kontext";
import { AbschnittKopf, PrivatKarte } from "./rahmen";

/**
 * Lohnabrechnungen: Foto oder PDF hochladen, nach Monat abgelegt, jederzeit
 * ansehen. Nur die Person selbst hat Zugriff (Migration 0204). Fotos werden
 * vorher verkleinert. Vor dem ersten Hochladen: ausdrückliche Einwilligung.
 */

const monatText = (iso: string) => `${monthName(Number(iso.slice(5, 7)) - 1)} ${iso.slice(0, 4)}`;

/** Voreinstellung: der Vormonat – die Abrechnung kommt meist im Folgemonat. */
function vormonat(): string {
  const h = heuteInBerlin();
  const j = Number(h.slice(0, 4));
  const m = Number(h.slice(5, 7)) - 1;
  const d = new Date(j, m - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PrivatLohnzettel() {
  const { konto } = usePrivat();
  const [einwilligung, setEinwilligung] = useState<boolean | null>(null);
  const [haken, setHaken] = useState(false);
  const [liste, setListe] = useState<Lohnzettel[] | null>(null);
  const [monat, setMonat] = useState(vormonat);
  const [titel, setTitel] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<Lohnzettel | null>(null);
  const [jobs, setJobs] = useState<string[]>([]);
  const datei = useRef<HTMLInputElement>(null);

  const laden = useCallback(async () => {
    try {
      const [e, l] = await Promise.all([einwilligungStand(), ladeLohnzettel()]);
      setEinwilligung(e);
      setListe(l);
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Konnte nicht geladen werden.");
      setEinwilligung((a) => a ?? false);
      setListe((a) => a ?? []);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
    setJobs(ladeGehaltEinstellungen(konto.userId).jobs.map((j) => j.name));
  }, [laden, konto.userId]);

  async function zustimmen() {
    setFehler(null);
    try {
      await setzeEinwilligung(true);
      setEinwilligung(true);
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Das konnte nicht gespeichert werden.");
    }
  }

  async function zuruecknehmen() {
    setFehler(null);
    try {
      await setzeEinwilligung(false);
      setEinwilligung(false);
      setHaken(false);
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Das konnte nicht gespeichert werden.");
    }
  }

  async function gewaehlt(dateien: File[]) {
    if (!dateien.length) return;
    setFehler(null);
    const neu: Lohnzettel[] = [];
    try {
      for (const [i, d] of dateien.entries()) {
        setLaeuft(dateien.length > 1 ? `Lädt hoch … ${i + 1} von ${dateien.length}` : "Lädt hoch …");
        neu.push(await hochladen(d, `${monat}-01`, titel));
      }
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Das Hochladen hat nicht geklappt.");
    } finally {
      setLaeuft(null);
      if (neu.length) setListe((a) => [...neu, ...(a ?? [])].sort((x, y) => y.monat.localeCompare(x.monat) || y.erstelltAm.localeCompare(x.erstelltAm)));
    }
  }

  const jahre = [...new Set((liste ?? []).map((z) => z.monat.slice(0, 4)))];

  return (
    <div className="space-y-4" data-lohnzettel>
      <AbschnittKopf icon={<FileText className="h-[18px] w-[18px]" />} titel="Lohnabrechnungen" unter="Nur für dich – jederzeit abrufbar" />
      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      {einwilligung === null ? (
        <p className="px-1 text-[14px] text-ink-muted">Wird geladen …</p>
      ) : !einwilligung ? (
        <PrivatKarte>
          <div className="space-y-3 px-4 py-4" data-lohnzettel-einwilligung>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-500/12 text-brand-600">
                <Lock className="h-5 w-5" />
              </span>
              <p className="text-[14px] leading-snug">
                Deine Lohnabrechnungen liegen verschlüsselt in einem privaten Speicher in der EU. <b>Nur du</b> kannst sie sehen –
                auch Leute, mit denen du teilst, und dein Betrieb nicht.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-[14px] bg-ink/[0.05] p-3">
              <input type="checkbox" checked={haken} onChange={(e) => setHaken(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500" />
              <span className="text-[13px] leading-snug">
                Ich willige ein, dass ShiftNexo meine hochgeladenen Lohnabrechnungen für mich speichert. Sie können Angaben zu
                Religion (Kirchensteuer) und Gesundheit (z. B. Krankenkasse) enthalten. Ich kann sie jederzeit löschen und die
                Einwilligung damit widerrufen.
              </span>
            </label>
            <button
              type="button"
              disabled={!haken}
              onClick={() => void zustimmen()}
              className="h-12 w-full rounded-[14px] bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Einverstanden
            </button>
          </div>
        </PrivatKarte>
      ) : (
        <>
          <PrivatKarte>
            <div className="space-y-3 px-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12.5px] font-semibold text-ink-muted">Monat</span>
                  <input
                    type="month"
                    value={monat}
                    max={heuteInBerlin().slice(0, 7)}
                    onChange={(e) => e.target.value && setMonat(e.target.value)}
                    className="h-11 w-full rounded-[12px] bg-ink/[0.06] px-3 text-[15px] font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12.5px] font-semibold text-ink-muted">Job (frei lassbar)</span>
                  <input
                    value={titel}
                    maxLength={60}
                    list="lohnzettel-jobs"
                    placeholder="z. B. Tankstelle"
                    onChange={(e) => setTitel(e.target.value)}
                    className="h-11 w-full rounded-[12px] bg-ink/[0.06] px-3 text-[15px]"
                  />
                  <datalist id="lohnzettel-jobs">
                    {jobs.map((j) => (
                      <option key={j} value={j} />
                    ))}
                  </datalist>
                </label>
              </div>
              <input
                ref={datei}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-label="Lohnabrechnung wählen"
                data-lohnzettel-datei
                onChange={(e) => {
                  void gewaehlt(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!!laeuft}
                onClick={() => datei.current?.click()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                <Upload className="h-[18px] w-[18px]" /> {laeuft ?? "Foto oder PDF hochladen"}
              </button>
              <p className="text-[12px] leading-snug text-ink-faint">Fotos werden vorher verkleinert, damit sie wenig Platz brauchen und gut lesbar bleiben.</p>
            </div>
          </PrivatKarte>

          {liste && liste.length ? (
            jahre.map((j) => (
              <section key={j} className="space-y-2">
                <h3 className="px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{j}</h3>
                <ul className="glas divide-y divide-line overflow-hidden rounded-[22px]">
                  {liste
                    .filter((z) => z.monat.startsWith(j))
                    .map((z) => (
                      <li key={z.id}>
                        <button type="button" onClick={() => setOffen(z)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink/[0.04]" data-lohnzettel-eintrag>
                          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]", z.typ === "application/pdf" ? "bg-crit-bg text-crit-fg" : "bg-brand-500/12 text-brand-600")}>
                            {z.typ === "application/pdf" ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15.5px] font-semibold">{monatText(z.monat)}</span>
                            <span className="block truncate text-[12.5px] text-ink-muted">
                              {z.titel ? `${z.titel} · ` : ""}
                              {z.typ === "application/pdf" ? "PDF" : "Foto"} · {groesseText(z.groesse)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ))
          ) : liste ? (
            <p className="px-1 text-[14px] text-ink-muted">Noch keine Lohnabrechnung gespeichert.</p>
          ) : null}

          {liste && !liste.length ? (
            <button type="button" onClick={() => void zuruecknehmen()} className="px-1 text-[13px] font-semibold text-ink-muted underline">
              Einwilligung zurücknehmen
            </button>
          ) : (
            <p className="px-1 text-[12px] leading-snug text-ink-faint">
              Zum Widerrufen der Einwilligung alle Lohnabrechnungen löschen. Mit dem Konto werden sie automatisch gelöscht.
            </p>
          )}
        </>
      )}

      {offen ? (
        <Ansicht
          z={offen}
          onClose={() => setOffen(null)}
          onGeloescht={(id) => {
            setListe((a) => (a ?? []).filter((x) => x.id !== id));
            setOffen(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** Eine Lohnabrechnung ansehen oder löschen. */
function Ansicht({ z, onClose, onGeloescht }: { z: Lohnzettel; onClose: () => void; onGeloescht: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, setFrage] = useState(false);
  useEffect(() => {
    let aus = false;
    ansehenLink(z.pfad)
      .then((u) => !aus && setUrl(u))
      .catch((x: unknown) => !aus && setFehler(x instanceof Error ? x.message : "Konnte nicht geöffnet werden."));
    return () => {
      aus = true;
    };
  }, [z.pfad]);

  async function weg() {
    try {
      await loeschen(z);
      onGeloescht(z.id);
    } catch (x) {
      setFehler(x instanceof Error ? x.message : "Das konnte nicht gelöscht werden.");
    }
  }

  return (
    <Blatt titel={monatText(z.monat)} unter={z.titel || undefined} onClose={onClose}>
      <div className="space-y-3 pb-2">
        {fehler ? <Alert tone="error">{fehler}</Alert> : null}
        {!url && !fehler ? <p className="text-[14px] text-ink-muted">Wird geöffnet …</p> : null}
        {url && z.typ === "image/jpeg" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Lohnabrechnung ${monatText(z.monat)}`} className="w-full rounded-[14px] border border-line bg-white" />
        ) : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="flex h-11 w-full items-center justify-center rounded-[14px] bg-ink/[0.07] text-[14.5px] font-semibold">
            {z.typ === "application/pdf" ? "PDF öffnen" : "In voller Größe öffnen"}
          </a>
        ) : null}
        {frage ? (
          <div className="space-y-2 rounded-[14px] bg-crit-bg p-3">
            <p className="text-[14px] font-semibold text-crit-fg">Diese Lohnabrechnung endgültig löschen?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFrage(false)} className="h-10 flex-1 rounded-[12px] bg-surface text-[14px] font-semibold">
                Abbrechen
              </button>
              <button type="button" onClick={() => void weg()} className="h-10 flex-1 rounded-[12px] bg-crit-dot text-[14px] font-semibold text-white">
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setFrage(true)} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-crit-fg">
            <Trash2 className="h-4 w-4" /> Löschen
          </button>
        )}
      </div>
    </Blatt>
  );
}
