"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, FileText, KeyRound, Lock, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  dateiAuf,
  dateiZu,
  jsonAuf,
  jsonZu,
  masterAendern,
  passwortVorschlag,
  tresorNeu,
  tresorOeffnen,
  type SchluesselZeile,
} from "./krypto";
import {
  dateiEintragen,
  dateiLink,
  dateiVorbereiten,
  eintragLoeschen,
  eintragSpeichern,
  masterSpeichern,
  tresorAnlegen,
  tresorGeoeffnet,
  tresorLaden,
  type TresorEintrag,
} from "./aktionen";

const SPERRE_NACH_MS = 10 * 60 * 1000;
const MIN_LAENGE = 12;

interface Zugang {
  titel: string;
  benutzer?: string;
  passwort?: string;
  link?: string;
  notiz?: string;
}
interface Unterlage {
  titel: string;
  name: string;
  typ: string;
  notiz?: string;
}
type Offen =
  | { id: string; art: "eintrag"; inhalt: Zugang; am: string }
  | { id: string; art: "datei"; inhalt: Unterlage; am: string; groesse: number | null };

const feld = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink/40";
const knopf = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";
const haupt = `${knopf} bg-ink text-surface hover:opacity-90`;
const neben = `${knopf} border border-line hover:bg-surface-muted`;

/**
 * Unterlagen & Tresor. Der Schlüssel lebt nur im Arbeitsspeicher dieses
 * Tabs; nach 10 Minuten ohne Bedienung oder beim Verlassen ist er weg.
 */
export function Tresor() {
  const [stand, setStand] = useState<"laden" | "fehler" | "neu" | "zu" | "offen">("laden");
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeile, setZeile] = useState<SchluesselZeile | null>(null);
  const [roh, setRoh] = useState<TresorEintrag[]>([]);
  const [schluessel, setSchluessel] = useState<CryptoKey | null>(null);
  const [liste, setListe] = useState<Offen[]>([]);
  const letzte = useRef(0);

  const sperren = useCallback(() => {
    setSchluessel(null);
    setListe([]);
    setStand((s) => (s === "offen" ? "zu" : s));
  }, []);

  const laden = useCallback(async () => {
    const r = await tresorLaden();
    if ("error" in r) {
      setFehler(r.error);
      setStand("fehler");
      return null;
    }
    setZeile(r.schluessel);
    setRoh(r.eintraege);
    return r;
  }, []);

  useEffect(() => {
    let aus = false;
    void (async () => {
      const r = await laden();
      if (r && !aus) setStand(r.schluessel ? "zu" : "neu");
    })();
    return () => {
      aus = true;
    };
  }, [laden]);

  // Entschlüsseln, sobald Schlüssel oder Daten sich ändern.
  useEffect(() => {
    if (!schluessel) return;
    let aus = false;
    Promise.all(
      roh.map(async (e): Promise<Offen | null> => {
        try {
          return e.art === "datei"
            ? { id: e.id, art: "datei", inhalt: await jsonAuf<Unterlage>(schluessel, e.daten), am: e.updated_at, groesse: e.groesse }
            : { id: e.id, art: "eintrag", inhalt: await jsonAuf<Zugang>(schluessel, e.daten), am: e.updated_at };
        } catch {
          return null;
        }
      }),
    ).then((l) => !aus && setListe(l.filter((x): x is Offen => x !== null)));
    return () => {
      aus = true;
    };
  }, [schluessel, roh]);

  // Automatisch sperren: nach 10 Minuten Ruhe und wenn der Tab versteckt wird.
  useEffect(() => {
    if (stand !== "offen") return;
    const bewegt = () => (letzte.current = Date.now());
    const uhr = window.setInterval(() => Date.now() - letzte.current > SPERRE_NACH_MS && sperren(), 15_000);
    const weg = () => document.visibilityState === "hidden" && (letzte.current = Date.now() - SPERRE_NACH_MS + 60_000);
    window.addEventListener("pointerdown", bewegt);
    window.addEventListener("keydown", bewegt);
    document.addEventListener("visibilitychange", weg);
    return () => {
      window.clearInterval(uhr);
      window.removeEventListener("pointerdown", bewegt);
      window.removeEventListener("keydown", bewegt);
      document.removeEventListener("visibilitychange", weg);
    };
  }, [stand, sperren]);

  if (stand === "laden") return <p className="text-sm text-ink-muted">Lädt …</p>;
  if (stand === "fehler") return <Hinweis rot>{fehler}</Hinweis>;
  if (stand === "neu")
    return (
      <Anlegen
        fertig={async (k) => {
          await laden();
          setSchluessel(k);
          letzte.current = Date.now();
          setStand("offen");
        }}
      />
    );
  if (stand === "zu" || !schluessel || !zeile)
    return (
      <Entsperren
        zeile={zeile!}
        offen={(k) => {
          setSchluessel(k);
          letzte.current = Date.now();
          setStand("offen");
          void tresorGeoeffnet();
        }}
      />
    );

  return (
    <Inhalt
      schluessel={schluessel}
      zeile={zeile}
      liste={liste}
      neuLaden={async () => void (await laden())}
      sperren={sperren}
    />
  );
}

function Hinweis({ children, rot = false }: { children: React.ReactNode; rot?: boolean }) {
  return (
    <p className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${rot ? "border-crit-fg/30 bg-crit-fg/5 text-crit-fg" : "border-line bg-surface-muted"}`}>
      {children}
    </p>
  );
}

function Karte({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">{children}</div>;
}

function Anlegen({ fertig }: { fertig: (k: CryptoKey) => Promise<void> }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ok, setOk] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const passt = a.length >= MIN_LAENGE && a === b && ok;
  return (
    <Karte>
      <h2 className="text-lg font-semibold">Tresor einrichten</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Leg ein eigenes Master-Passwort fest – nicht dein Konsolen-Passwort. Alles im Tresor wird damit in deinem Browser verschlüsselt.
      </p>
      <div className="mt-4 grid max-w-md gap-3">
        <input type="password" autoComplete="new-password" className={feld} placeholder={`Master-Passwort (mind. ${MIN_LAENGE} Zeichen)`} value={a} onChange={(e) => setA(e.target.value)} data-master-neu />
        <input type="password" autoComplete="new-password" className={feld} placeholder="Wiederholen" value={b} onChange={(e) => setB(e.target.value)} data-master-wdh />
        {b && a !== b ? <p className="text-[13px] text-crit-fg">Die beiden Passwörter sind nicht gleich.</p> : null}
        <label className="flex items-start gap-2 text-[13px] leading-relaxed">
          <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} data-master-ok />
          <span>
            Ich habe verstanden: <b>Ist das Master-Passwort weg, ist alles im Tresor weg.</b> Niemand kann es zurücksetzen – auch nicht der Entwickler. Ich bewahre es sicher auf (z. B. auf Papier im Safe).
          </span>
        </label>
        {fehler ? <Hinweis rot>{fehler}</Hinweis> : null}
        <button
          type="button"
          className={haupt}
          disabled={!passt || laeuft}
          onClick={async () => {
            setLaeuft(true);
            setFehler(null);
            const { zeile, schluessel } = await tresorNeu(a);
            const r = await tresorAnlegen(zeile);
            if (r.error) {
              setFehler(r.error);
              setLaeuft(false);
              return;
            }
            await fertig(schluessel);
          }}
        >
          <Lock className="size-4" /> {laeuft ? "Wird eingerichtet …" : "Tresor anlegen"}
        </button>
      </div>
    </Karte>
  );
}

function Entsperren({ zeile, offen }: { zeile: SchluesselZeile; offen: (k: CryptoKey) => void }) {
  const [pw, setPw] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Lock className="size-5" /> Tresor gesperrt
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Master-Passwort eingeben. Nach 10 Minuten ohne Bedienung sperrt er sich wieder.</p>
      <form
        className="mt-4 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setLaeuft(true);
          setFehler(null);
          try {
            offen(await tresorOeffnen(pw, zeile));
          } catch {
            setFehler("Falsches Master-Passwort.");
            setLaeuft(false);
          }
        }}
      >
        <input type="password" autoComplete="current-password" autoFocus className={feld} placeholder="Master-Passwort" value={pw} onChange={(e) => setPw(e.target.value)} data-master />
        <button type="submit" className={haupt} disabled={!pw || laeuft}>
          {laeuft ? "…" : "Öffnen"}
        </button>
      </form>
      {fehler ? <div className="mt-3 max-w-md"><Hinweis rot>{fehler}</Hinweis></div> : null}
    </Karte>
  );
}

function Inhalt({
  schluessel,
  zeile,
  liste,
  neuLaden,
  sperren,
}: {
  schluessel: CryptoKey;
  zeile: SchluesselZeile;
  liste: Offen[];
  neuLaden: () => Promise<void>;
  sperren: () => void;
}) {
  const [reiter, setReiter] = useState<"zugang" | "datei">("zugang");
  const [suche, setSuche] = useState("");
  const [bearbeite, setBearbeite] = useState<{ id: string | null; inhalt: Zugang } | null>(null);
  const [master, setMaster] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return liste
      .filter((e) => (reiter === "zugang" ? e.art === "eintrag" : e.art === "datei"))
      .filter((e) => !s || JSON.stringify({ ...e.inhalt, passwort: undefined }).toLowerCase().includes(s))
      .sort((x, y) => x.inhalt.titel.localeCompare(y.inhalt.titel, "de"));
  }, [liste, reiter, suche]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-lg border border-line bg-surface-muted p-0.5">
          {(
            [
              ["zugang", "Zugangsdaten", KeyRound],
              ["datei", "Unterlagen", FileText],
            ] as const
          ).map(([k, t, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={reiter === k}
              onClick={() => setReiter(k)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${reiter === k ? "bg-surface shadow-card" : "text-ink-muted"}`}
            >
              <Icon className="size-4" /> {t} ({liste.filter((e) => (k === "zugang" ? e.art === "eintrag" : e.art === "datei")).length})
            </button>
          ))}
        </div>
        <label className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-muted" />
          <input className={`${feld} pl-8`} placeholder="Suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </label>
        <button type="button" className={neben} onClick={() => setMaster((m) => !m)}>
          Master-Passwort ändern
        </button>
        <button type="button" className={neben} onClick={sperren} data-tresor-sperren>
          <Lock className="size-4" /> Sperren
        </button>
      </div>

      {meldung ? <Hinweis>{meldung}</Hinweis> : null}
      {master ? (
        <MasterAendern
          zeile={zeile}
          fertig={async (m) => {
            setMaster(false);
            setMeldung(m);
            await neuLaden();
          }}
        />
      ) : null}

      {reiter === "zugang" ? (
        <>
          {bearbeite ? (
            <ZugangForm
              schluessel={schluessel}
              start={bearbeite}
              fertig={async () => {
                setBearbeite(null);
                await neuLaden();
              }}
              abbrechen={() => setBearbeite(null)}
            />
          ) : (
            <button type="button" className={haupt} onClick={() => setBearbeite({ id: null, inhalt: { titel: "" } })} data-zugang-neu>
              <Plus className="size-4" /> Zugang hinzufügen
            </button>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gefiltert.map((e) =>
              e.art === "eintrag" ? (
                <ZugangKarte key={e.id} e={e} bearbeiten={() => setBearbeite({ id: e.id, inhalt: e.inhalt })} geloescht={neuLaden} />
              ) : null,
            )}
          </div>
        </>
      ) : (
        <>
          <Hochladen schluessel={schluessel} fertig={neuLaden} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gefiltert.map((e) => (e.art === "datei" ? <DateiKarte key={e.id} e={e} schluessel={schluessel} geloescht={neuLaden} /> : null))}
          </div>
        </>
      )}
      {!gefiltert.length ? <p className="text-sm text-ink-muted">{suche ? "Nichts gefunden." : "Noch leer."}</p> : null}
    </div>
  );
}

function kopieren(text: string) {
  void navigator.clipboard?.writeText(text);
  // Passwort nach 30 Sekunden aus der Zwischenablage nehmen (wenn erlaubt).
  window.setTimeout(() => {
    navigator.clipboard
      ?.readText?.()
      .then((jetzt) => {
        if (jetzt === text) void navigator.clipboard.writeText("");
      })
      .catch(() => undefined);
  }, 30_000);
}

function Zeile({ label, wert, geheim = false }: { label: string; wert?: string; geheim?: boolean }) {
  const [zeigen, setZeigen] = useState(false);
  if (!wert) return null;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-16 shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono">{geheim && !zeigen ? "••••••••••" : wert}</span>
      {geheim ? (
        <button type="button" aria-label={zeigen ? "Verbergen" : "Zeigen"} className="rounded p-1 hover:bg-surface-muted" onClick={() => setZeigen((z) => !z)}>
          {zeigen ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : null}
      <button type="button" aria-label={`${label} kopieren`} className="rounded p-1 hover:bg-surface-muted" onClick={() => kopieren(wert)}>
        <Copy className="size-4" />
      </button>
    </div>
  );
}

function ZugangKarte({ e, bearbeiten, geloescht }: { e: Extract<Offen, { art: "eintrag" }>; bearbeiten: () => void; geloescht: () => Promise<void> }) {
  const z = e.inhalt;
  return (
    <div className="rounded-xl border border-line bg-surface p-3" data-zugang>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{z.titel}</p>
        <div className="flex gap-1">
          <button type="button" className="rounded px-2 py-1 text-[13px] hover:bg-surface-muted" onClick={bearbeiten}>
            Ändern
          </button>
          <Loeschen id={e.id} titel={z.titel} fertig={geloescht} />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <Zeile label="Benutzer" wert={z.benutzer} />
        <Zeile label="Passwort" wert={z.passwort} geheim />
        {z.link ? (
          <a href={z.link.startsWith("http") ? z.link : `https://${z.link}`} target="_blank" rel="noreferrer noopener" className="block truncate text-[13px] text-ink-muted underline">
            {z.link}
          </a>
        ) : null}
        {z.notiz ? <p className="whitespace-pre-wrap text-[13px] text-ink-muted">{z.notiz}</p> : null}
      </div>
    </div>
  );
}

function Loeschen({ id, titel, fertig }: { id: string; titel: string; fertig: () => Promise<void> }) {
  return (
    <button
      type="button"
      aria-label="Löschen"
      className="rounded p-1.5 text-crit-fg hover:bg-crit-fg/10"
      onClick={async () => {
        if (!window.confirm(`„${titel}“ endgültig löschen?`)) return;
        const r = await eintragLoeschen(id);
        if (r.error) window.alert(r.error);
        await fertig();
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function ZugangForm({
  schluessel,
  start,
  fertig,
  abbrechen,
}: {
  schluessel: CryptoKey;
  start: { id: string | null; inhalt: Zugang };
  fertig: () => Promise<void>;
  abbrechen: () => void;
}) {
  const [z, setZ] = useState<Zugang>(start.inhalt);
  const [zeigen, setZeigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const setze = (k: keyof Zugang) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setZ((alt) => ({ ...alt, [k]: e.target.value }));
  return (
    <Karte>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setLaeuft(true);
          const r = await eintragSpeichern(start.id, await jsonZu(schluessel, z));
          if (r.error) {
            setFehler(r.error);
            setLaeuft(false);
            return;
          }
          await fertig();
        }}
      >
        <input className={`${feld} sm:col-span-2`} placeholder="Titel (z. B. Supabase, Domain, Bank)" required value={z.titel} onChange={setze("titel")} data-zugang-titel />
        <input className={feld} placeholder="Benutzer / E-Mail" autoComplete="off" value={z.benutzer ?? ""} onChange={setze("benutzer")} />
        <div className="flex gap-1">
          <input className={feld} type={zeigen ? "text" : "password"} autoComplete="new-password" placeholder="Passwort" value={z.passwort ?? ""} onChange={setze("passwort")} data-zugang-passwort />
          <button type="button" aria-label="Zeigen" className={neben} onClick={() => setZeigen((x) => !x)}>
            {zeigen ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button type="button" aria-label="Starkes Passwort vorschlagen" title="Starkes Passwort vorschlagen" className={neben} onClick={() => (setZ((alt) => ({ ...alt, passwort: passwortVorschlag() })), setZeigen(true))}>
            <RefreshCw className="size-4" />
          </button>
        </div>
        <input className={`${feld} sm:col-span-2`} placeholder="Link (optional)" value={z.link ?? ""} onChange={setze("link")} />
        <textarea className={`${feld} sm:col-span-2`} rows={3} placeholder="Notiz (z. B. Wiederherstellungscodes, Kundennummer)" value={z.notiz ?? ""} onChange={setze("notiz")} />
        {fehler ? <div className="sm:col-span-2"><Hinweis rot>{fehler}</Hinweis></div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={haupt} disabled={!z.titel.trim() || laeuft} data-zugang-speichern>
            {laeuft ? "Speichert …" : "Verschlüsselt speichern"}
          </button>
          <button type="button" className={neben} onClick={abbrechen}>
            Abbrechen
          </button>
        </div>
      </form>
    </Karte>
  );
}

function Hochladen({ schluessel, fertig }: { schluessel: CryptoKey; fertig: () => Promise<void> }) {
  const [datei, setDatei] = useState<File | null>(null);
  const [titel, setTitel] = useState("");
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  return (
    <Karte>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <button type="button" className={neben} onClick={() => eingabe.current?.click()}>
          <Upload className="size-4" /> {datei ? "Andere Datei" : "Datei wählen"}
        </button>
        <input
          ref={eingabe}
          type="file"
          hidden
          accept="application/pdf,image/*,.txt,.doc,.docx,.xls,.xlsx"
          data-datei-wahl
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setDatei(f);
            if (f && !titel) setTitel(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
        <p className="self-center truncate text-sm text-ink-muted">{datei ? `${datei.name} · ${groesse(datei.size)}` : "PDF, Bild oder Dokument, höchstens 25 MB"}</p>
        {datei ? (
          <>
            <input className={`${feld} sm:col-span-2`} placeholder="Titel (z. B. Gewerbeanmeldung)" value={titel} onChange={(e) => setTitel(e.target.value)} data-datei-titel />
            <input className={`${feld} sm:col-span-2`} placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
            {fehler ? <div className="sm:col-span-2"><Hinweis rot>{fehler}</Hinweis></div> : null}
            <button
              type="button"
              className={`${haupt} sm:col-span-2 sm:justify-self-start`}
              disabled={laeuft || !titel.trim()}
              data-datei-hochladen
              onClick={async () => {
                setLaeuft(true);
                setFehler(null);
                try {
                  const geheim = await dateiZu(schluessel, datei);
                  const v = await dateiVorbereiten(geheim.size);
                  if (v.error || !v.pfad || !v.token) throw new Error(v.error ?? "Hochladen ist gerade nicht möglich.");
                  const up = await createClient().storage.from("konsole-tresor").uploadToSignedUrl(v.pfad, v.token, geheim, { contentType: "application/octet-stream" });
                  if (up.error) throw new Error("Hochladen hat nicht geklappt.");
                  const meta: Unterlage = { titel: titel.trim(), name: datei.name, typ: datei.type || "application/octet-stream", notiz: notiz.trim() || undefined };
                  const r = await dateiEintragen(v.pfad, await jsonZu(schluessel, meta), datei.size);
                  if (r.error) throw new Error(r.error);
                  setDatei(null);
                  setTitel("");
                  setNotiz("");
                  await fertig();
                } catch (e) {
                  setFehler(e instanceof Error ? e.message : "Hochladen hat nicht geklappt.");
                }
                setLaeuft(false);
              }}
            >
              <Lock className="size-4" /> {laeuft ? "Verschlüsselt und lädt hoch …" : "Verschlüsselt hochladen"}
            </button>
          </>
        ) : null}
      </div>
    </Karte>
  );
}

function groesse(b: number | null): string {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

function DateiKarte({ e, schluessel, geloescht }: { e: Extract<Offen, { art: "datei" }>; schluessel: CryptoKey; geloescht: () => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false);
  const holen = async (speichern: boolean) => {
    setLaeuft(true);
    try {
      const l = await dateiLink(e.id);
      if (!l.url) throw new Error(l.error);
      const antwort = await fetch(l.url);
      if (!antwort.ok) throw new Error();
      const blob = await dateiAuf(schluessel, await antwort.arrayBuffer(), e.inhalt.typ);
      const url = URL.createObjectURL(blob);
      if (speichern) {
        const a = document.createElement("a");
        a.href = url;
        a.download = e.inhalt.name;
        a.click();
      } else {
        window.open(url, "_blank", "noopener");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      window.alert(err instanceof Error && err.message ? err.message : "Die Datei ließ sich nicht öffnen.");
    }
    setLaeuft(false);
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-3" data-unterlage>
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-ink-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{e.inhalt.titel}</p>
          <p className="truncate text-[12px] text-ink-muted">
            {e.inhalt.name} · {groesse(e.groesse)} · {new Date(e.am).toLocaleDateString("de-DE")}
          </p>
          {e.inhalt.notiz ? <p className="mt-1 text-[13px] text-ink-muted">{e.inhalt.notiz}</p> : null}
        </div>
        <Loeschen id={e.id} titel={e.inhalt.titel} fertig={geloescht} />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={neben} disabled={laeuft} onClick={() => holen(false)}>
          Öffnen
        </button>
        <button type="button" className={neben} disabled={laeuft} onClick={() => holen(true)}>
          Herunterladen
        </button>
      </div>
    </div>
  );
}

function MasterAendern({ zeile, fertig }: { zeile: SchluesselZeile; fertig: (meldung: string) => Promise<void> }) {
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [wdh, setWdh] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <Karte>
      <h3 className="font-semibold">Master-Passwort ändern</h3>
      <p className="mt-1 text-[13px] text-ink-muted">Gilt danach für das ganze Team. Gib das neue Passwort nur persönlich weiter.</p>
      <div className="mt-3 grid max-w-md gap-2">
        <input type="password" autoComplete="current-password" className={feld} placeholder="Bisheriges Master-Passwort" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <input type="password" autoComplete="new-password" className={feld} placeholder={`Neues Master-Passwort (mind. ${MIN_LAENGE} Zeichen)`} value={neu} onChange={(e) => setNeu(e.target.value)} />
        <input type="password" autoComplete="new-password" className={feld} placeholder="Neues wiederholen" value={wdh} onChange={(e) => setWdh(e.target.value)} />
        {fehler ? <Hinweis rot>{fehler}</Hinweis> : null}
        <button
          type="button"
          className={haupt}
          disabled={laeuft || !alt || neu.length < MIN_LAENGE || neu !== wdh}
          onClick={async () => {
            setLaeuft(true);
            setFehler(null);
            try {
              const z = await masterAendern(alt, neu, zeile);
              const r = await masterSpeichern(zeile.schluessel, z);
              if (r.error) throw new Error(r.error);
              await fertig("Master-Passwort geändert.");
            } catch (e) {
              setFehler(e instanceof Error && e.message && !e.message.includes("operation") ? e.message : "Das bisherige Master-Passwort stimmt nicht.");
              setLaeuft(false);
            }
          }}
        >
          Ändern
        </button>
      </div>
    </Karte>
  );
}
