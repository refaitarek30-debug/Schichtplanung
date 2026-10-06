"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LogIn, PencilLine, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import {
  DataError,
  fetchProtokoll,
  fetchProtokollZahlen,
  type ProtokollArt,
  type ProtokollEintrag,
  type ProtokollZahlen,
} from "@/lib/data/protokoll";
import { beschreibe, type ProtokollKategorie } from "@/lib/protokoll-text";
import { cn } from "@/lib/utils";

const SEITE = 150;

const ZEITRAEUME = [
  { tage: 1, label: "Letzte 24 Stunden" },
  { tage: 7, label: "Letzte 7 Tage" },
  { tage: 30, label: "Letzte 30 Tage" },
  { tage: 90, label: "Letzte 90 Tage" },
] as const;

const ARTEN: { wert: ProtokollArt | null; label: string }[] = [
  { wert: null, label: "Alles" },
  { wert: "anmeldung", label: "Anmeldungen" },
  { wert: "aenderung", label: "Änderungen" },
  { wert: "fehler", label: "Fehler" },
];

const PUNKT: Record<ProtokollKategorie, string> = {
  anmeldung: "bg-info-fg",
  fehlanmeldung: "bg-warn-dot",
  aenderung: "bg-brand-500",
  fehler: "bg-crit-dot",
};

const uhrzeit = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const tagFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function tagSchluessel(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function tagUeberschrift(d: Date): string {
  const heute = new Date();
  const gestern = new Date();
  gestern.setDate(heute.getDate() - 1);
  if (tagSchluessel(d) === tagSchluessel(heute)) return "Heute";
  if (tagSchluessel(d) === tagSchluessel(gestern)) return "Gestern";
  return tagFormat.format(d);
}

function Kachel({
  icon: Icon,
  titel,
  wert,
  unter,
  ton,
  aktiv,
  onClick,
}: {
  icon: typeof LogIn;
  titel: string;
  wert: number | null;
  unter?: string;
  ton: "info" | "brand" | "crit" | "warn";
  aktiv: boolean;
  onClick: () => void;
}) {
  const farben = {
    info: "text-info-fg bg-info-bg",
    brand: "text-brand-700 bg-brand-50",
    crit: "text-crit-fg bg-crit-bg",
    warn: "text-warn-fg bg-warn-bg",
  }[ton];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={cn(
        "flex items-center gap-3 rounded-card border bg-surface px-3.5 py-3 text-left shadow-card transition-colors",
        aktiv ? "border-brand-600 ring-1 ring-brand-600" : "border-line hover:bg-surface-muted",
      )}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", farben)}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-muted">{titel}</span>
        <span className="tnum block text-lg font-semibold leading-tight">{wert ?? "–"}</span>
        {unter ? <span className="block text-[11px] text-ink-faint">{unter}</span> : null}
      </span>
    </button>
  );
}

/**
 * Protokoll: Anmeldungen, Änderungen und Fehler der eigenen Firma.
 *
 * Nur für freigeschaltete Personen (siehe Layout und `protokoll_liste()`).
 * Inhalte von Kommentaren und Krankmeldungen stehen bewusst nicht drin.
 */
export default function ProtokollPage() {
  const [tage, setTage] = useState(7);
  const [art, setArt] = useState<ProtokollArt | null>(null);
  const [suche, setSuche] = useState("");
  const [eintraege, setEintraege] = useState<ProtokollEintrag[] | null>(null);
  const [zahlen, setZahlen] = useState<ProtokollZahlen | null>(null);
  const [mehrDa, setMehrDa] = useState(false);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stand, setStand] = useState(0);

  const laden = useCallback(async () => {
    try {
      const [liste, kopf] = await Promise.all([
        fetchProtokoll(tage, art, null, SEITE),
        fetchProtokollZahlen(tage),
      ]);
      setFehler(null);
      setEintraege(liste);
      setZahlen(kopf);
      setMehrDa(liste.length === SEITE);
    } catch (caught) {
      setEintraege([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Das Protokoll konnte nicht geladen werden.",
      );
    }
  }, [tage, art]);

  useEffect(() => {
    // Laden setzt den Zustand erst nach der Antwort der Datenbank.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden, stand]);

  async function aeltereLaden() {
    if (!eintraege?.length) return;
    setLaedtMehr(true);
    try {
      const weitere = await fetchProtokoll(tage, art, eintraege[eintraege.length - 1].zeit, SEITE);
      setEintraege((bisher) => [...(bisher ?? []), ...weitere]);
      setMehrDa(weitere.length === SEITE);
    } catch (caught) {
      setFehler(
        caught instanceof DataError ? caught.message : "Weitere Einträge konnten nicht geladen werden.",
      );
    } finally {
      setLaedtMehr(false);
    }
  }

  // Lesbare Zeilen, gefiltert nach Suche, gruppiert nach Tag.
  const tageListe = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    const gruppen: { schluessel: string; titel: string; zeilen: (ProtokollEintrag & ReturnType<typeof beschreibe>)[] }[] = [];
    for (const e of eintraege ?? []) {
      const zeile = { ...e, ...beschreibe(e) };
      if (begriff) {
        const heu = `${e.akteur ?? ""} ${e.betroffen ?? ""} ${zeile.text} ${zeile.zusatz ?? ""}`.toLowerCase();
        if (!heu.includes(begriff)) continue;
      }
      const d = new Date(e.zeit);
      const schluessel = tagSchluessel(d);
      const letzte = gruppen[gruppen.length - 1];
      if (letzte?.schluessel === schluessel) letzte.zeilen.push(zeile);
      else gruppen.push({ schluessel, titel: tagUeberschrift(d), zeilen: [zeile] });
    }
    return gruppen;
  }, [eintraege, suche]);

  const umschalten = (neu: ProtokollArt | null) => {
    setEintraege(null);
    setArt((bisher) => (bisher === neu ? null : neu));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Protokoll"
        description="Wer sich wann angemeldet hat, wer was geändert hat und wo jemandem eine Fehlermeldung angezeigt wurde. Nur für dich sichtbar."
        action={
          <button
            type="button"
            onClick={() => {
              setEintraege(null);
              setStand((n) => n + 1);
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:bg-surface-muted sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            Aktualisieren
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kachel
          icon={LogIn}
          titel="Anmeldungen"
          wert={zahlen?.anmeldungen ?? null}
          unter={zahlen ? `${zahlen.personen} ${zahlen.personen === 1 ? "Person" : "Personen"}` : undefined}
          ton="info"
          aktiv={art === "anmeldung"}
          onClick={() => umschalten("anmeldung")}
        />
        <Kachel
          icon={PencilLine}
          titel="Änderungen"
          wert={zahlen?.aenderungen ?? null}
          ton="brand"
          aktiv={art === "aenderung"}
          onClick={() => umschalten("aenderung")}
        />
        <Kachel
          icon={AlertTriangle}
          titel="Fehlermeldungen"
          wert={zahlen?.fehler ?? null}
          ton="crit"
          aktiv={art === "fehler"}
          onClick={() => umschalten("fehler")}
        />
        <Kachel
          icon={ShieldAlert}
          titel="Falsche Passwörter"
          wert={zahlen?.fehlanmeldungen ?? null}
          unter="bei bekannten Konten"
          ton="warn"
          aktiv={false}
          onClick={() => {
            umschalten("anmeldung");
            setSuche("fehlgeschlagen");
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Art">
          {ARTEN.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setEintraege(null);
                setArt(a.wert);
              }}
              aria-pressed={art === a.wert}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                art === a.wert
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line bg-surface hover:bg-surface-muted",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <select
          value={tage}
          onChange={(e) => {
            setEintraege(null);
            setTage(Number(e.target.value));
          }}
          aria-label="Zeitraum"
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px]"
        >
          {ZEITRAEUME.map((z) => (
            <option key={z.tage} value={z.tage}>
              {z.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Name oder Stichwort …"
          aria-label="Suchen"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-base sm:max-w-xs sm:text-[13px]"
        />
      </div>

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <Card className="overflow-hidden">
        {eintraege === null ? (
          <RowSkeleton rows={6} />
        ) : tageListe.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">
            {suche ? "Keine Einträge zu dieser Suche." : "In diesem Zeitraum ist nichts protokolliert."}
          </p>
        ) : (
          <div>
            {tageListe.map((tag) => (
              <section key={tag.schluessel}>
                <h2 className="border-b border-line bg-surface-muted px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted sm:px-5">
                  {tag.titel}
                  <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-faint">
                    · {tag.zeilen.length} {tag.zeilen.length === 1 ? "Eintrag" : "Einträge"}
                  </span>
                </h2>
                <ul className="divide-y divide-line">
                  {tag.zeilen.map((z) => (
                    <li key={z.id} className="flex gap-3 px-4 py-2.5 sm:px-5">
                      <span className="tnum w-11 shrink-0 pt-px text-[12px] text-ink-faint">
                        {uhrzeit.format(new Date(z.zeit))}
                      </span>
                      <span
                        aria-hidden
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PUNKT[z.kategorie])}
                      />
                      <span className="min-w-0 text-[13px] leading-snug">
                        <span className="font-semibold">
                          {z.akteur ?? (z.kategorie === "fehlanmeldung" ? "Unbekannt" : "System")}
                        </span>{" "}
                        <span className={cn(z.kategorie === "fehler" && "text-crit-fg")}>{z.text}</span>
                        {z.zusatz ? (
                          <span className="mt-0.5 block break-words text-[12px] text-ink-faint">
                            {z.zusatz}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {mehrDa ? (
              <div className="border-t border-line px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => void aeltereLaden()}
                  disabled={laedtMehr}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:bg-surface-muted disabled:opacity-50"
                >
                  {laedtMehr ? "Lädt …" : "Ältere Einträge laden"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <p className="text-[12px] text-ink-faint">
        Anmeldungen und Fehlermeldungen werden nach 90 Tagen gelöscht, Änderungen nach 24 Monaten.
        Inhalte von Kommentaren und Krankmeldungen werden nicht protokolliert.
      </p>
    </div>
  );
}
