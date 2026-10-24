"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Lock, Undo2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { heuteInBerlin } from "@/lib/dates";
import { farbStil, ladeTage, type TagEintrag } from "@/lib/privat/daten";
import { IcsFehler, leseIcs, MAX_BYTES, type Gruppe, type LeseErgebnis } from "@/lib/privat/ics-lesen";
import { beendeTexterkennung, erkenneScreenshot } from "@/lib/privat/screenshot-ocr";
import {
  bestimmeMonat,
  leseMonatsraster,
  vereineGruppen,
  type ErkannterTermin,
  type Gitter,
  type Monat,
  type Wort,
} from "@/lib/privat/screenshot-raster";
import { loescheTermin, speichereTermin } from "@/lib/data/partner";
import {
  fuehreAus,
  macheRueckgaengig,
  neueArtAus,
  planeImport,
  schlageVor,
  type Ergebnis,
  type Modus,
  type Ziel,
} from "@/lib/privat/import";
import { holeImportDateien } from "@/lib/privat/import-dateien";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf } from "./rahmen";

const SCHRITTE = ["Hochladen", "Prüfen"];

const QUELLEN: { id: string; name: string; anleitung: string[] }[] = [
  {
    id: "supershift",
    name: "Supershift",
    anleitung: [
      "Öffne in Supershift die Einstellungen und such nach „Kalender exportieren“ oder „Teilen“.",
      "Exportiere den gewünschten Zeitraum als Kalender-Datei (.ics) und speichere sie auf deinem Handy.",
      "Komm hierher zurück und wähl im nächsten Schritt die Datei aus.",
    ],
  },
  {
    id: "google",
    name: "Google Kalender",
    anleitung: [
      "Öffne calendar.google.com am Computer und dort die Einstellungen.",
      "Wähle „Importieren & Exportieren“ und dann „Exportieren“. Du bekommst eine ZIP-Datei mit einer .ics-Datei pro Kalender.",
      "Entpack sie, schick dir die passende .ics-Datei aufs Handy und wähl sie im nächsten Schritt aus.",
    ],
  },
  {
    id: "iphone",
    name: "iPhone-Kalender",
    anleitung: [
      "Öffne die Kalender-App, tipp unten auf „Kalender“ und dann beim gewünschten Kalender auf das Info-Symbol.",
      "Such nach „Teilen“ oder „Exportieren“, falls dein iOS das anbietet – sonst geht es am Mac über Ablage → Exportieren.",
      "Speichere die .ics-Datei in „Dateien“ und wähl sie im nächsten Schritt aus.",
    ],
  },
  {
    id: "andere",
    name: "Andere Datei",
    anleitung: [
      "Fast jede Kalender- oder Schicht-App kann eine Kalender-Datei (.ics) ausgeben.",
      "Such in der App nach „Exportieren“, „Teilen“ oder „Kalender-Datei“.",
      "Speichere die Datei auf deinem Handy und wähl sie im nächsten Schritt aus.",
    ],
  },
];

const MODI: { id: Modus; text: string; hinweis: string }[] = [
  { id: "leer", text: "Nur leere Tage füllen", hinweis: "Was schon im Kalender steht, bleibt unverändert." },
  { id: "ueber", text: "Überschreiben", hinweis: "Tage aus der Datei ersetzen, was dort bisher stand." },
  { id: "zusatz", text: "Als weiteren Eintrag ergänzen", hinweis: "Was schon steht, bleibt; der neue kommt dahinter (bis zu drei je Tag)." },
];

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const MAX_BILD_BYTES = 15 * 1024 * 1024;

interface Bild {
  id: number;
  name: string;
  vorschau: string;
  status: "liest" | "fertig" | "fehler";
  /** 0–1 */
  anteil: number;
  woerter: Wort[];
  gitter: Gitter | null;
  jahr: number;
  monat: number;
  /** Woher Monat und Jahr kommen (null = nicht erkannt, Vorgabe heute) */
  quelle: Monat["quelle"] | null;
  fehler?: string;
}

/** Was mit einem erkannten Termin passiert. */
type TerminWahl = "termin" | "schicht" | "weg";
const terminSchluessel = (t: ErkannterTermin) => `${t.tag}|${t.beginn}|${t.titel}`;

/** "HH:MM" + 1 Stunde (höchstens 23:59). */
function plusStunde(zeit: string): string {
  const [h, m] = zeit.split(":").map(Number);
  const n = Math.min(23 * 60 + 59, (h ?? 0) * 60 + (m ?? 0) + 60);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/** Alle Tage eines Monats als Raster (Montag zuerst), davor Leerstellen. */
function monatsRaster(jahr: number, monat: number): (string | null)[] {
  const erster = new Date(Date.UTC(jahr, monat, 1));
  const vorlauf = (erster.getUTCDay() + 6) % 7;
  const anzahl = new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
  const zellen: (string | null)[] = Array(vorlauf).fill(null);
  for (let t = 1; t <= anzahl; t++) zellen.push(`${jahr}-${String(monat + 1).padStart(2, "0")}-${String(t).padStart(2, "0")}`);
  return zellen;
}

function Fortschritt({ schritt }: { schritt: number }) {
  return (
    <ol className="mb-4 flex items-center gap-1.5" aria-label="Schritte">
      {SCHRITTE.map((s, i) => (
        <li key={s} className="flex-1" aria-current={i === schritt ? "step" : undefined}>
          <span className={cn("block h-1.5 rounded-full", i <= schritt ? "bg-brand-500" : "bg-ink/10")} />
          <span className={cn("mt-1 block text-center text-[11px] font-semibold", i === schritt ? "text-ink" : "text-ink-faint")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Schichten aus einer anderen App übernehmen – über eine Kalender-Datei, die nur im Browser gelesen wird. */
export function PrivatImport() {
  const { schichtarten, artNach, ladeArtenNeu } = usePrivat();
  const arten = useMemo(() => schichtarten ?? [], [schichtarten]);
  const [schritt, setSchritt] = useState(0);
  const [quelle, setQuelle] = useState<string>("supershift");
  const [, setDateiname] = useState("");
  const [ics, setIcs] = useState<LeseErgebnis | null>(null);
  const [bilder, setBilder] = useState<Bild[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [ueberschrieben, setUeberschrieben] = useState<Record<string, Ziel>>({});
  const [vorhanden, setVorhanden] = useState<Record<string, TagEintrag>>({});
  const [modus, setModus] = useState<Modus>("leer");
  const [arbeitet, setArbeitet] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [zurueck, setZurueck] = useState(false);
  const [terminWahl, setTerminWahl] = useState<Record<string, TerminWahl>>({});
  const [termineAngelegt, setTermineAngelegt] = useState<string[]>([]);
  const [gestartet, setGestartet] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  const weiterLaeuft = useRef(false);
  const geladenFuer = useRef("");
  const lauf = useRef(0);
  const urls = useRef<string[]>([]);

  // Beim Verlassen: Bildvorschauen freigeben und die Texterkennung beenden.
  useEffect(() => {
    const liste = urls.current;
    return () => {
      lauf.current += 1;
      for (const u of liste) URL.revokeObjectURL(u);
      void beendeTexterkennung();
    };
  }, []);

  // Screenshots: Monatsraster je Bild; mit Monat/Jahr der Person neu gerechnet.
  // Namen und Kürzel der eigenen Schichten gelten sicher als Schicht.
  const bekannte = useMemo(() => arten.flatMap((a) => [a.name, a.kuerzel]), [arten]);
  const raster = useMemo(
    () => bilder.map((b) => (b.status === "fertig" ? leseMonatsraster(b.woerter, b.jahr, b.monat, { bekannte, gitter: b.gitter }) : null)),
    [bilder, bekannte],
  );
  // Termine aus den Screenshots (doppelte zusammengefasst); die Person entscheidet je Termin.
  const erkannteTermine = useMemo(() => {
    const m = new Map<string, ErkannterTermin>();
    for (const r of raster) for (const t of r?.termine ?? []) m.set(terminSchluessel(t), t);
    return [...m.values()].sort((a, b) => a.tag.localeCompare(b.tag) || a.beginn.localeCompare(b.beginn));
  }, [raster]);
  const wahlVon = (t: ErkannterTermin): TerminWahl => terminWahl[terminSchluessel(t)] ?? "termin";
  const termineZuUebernehmen = erkannteTermine.filter((t) => wahlVon(t) === "termin");
  const gelesen = useMemo<LeseErgebnis | null>(() => {
    // Termine, die eigentlich Schichten sind, kommen als eigene Namen dazu.
    const alsSchicht = erkannteTermine
      .filter((t) => (terminWahl[terminSchluessel(t)] ?? "termin") === "schicht")
      .map((t) => ({ name: t.titel, tage: [t.tag], beginn: t.beginn, ende: t.ende, ganztaegig: !t.beginn || !t.ende }));
    const gr = vereineGruppen(ics?.gruppen ?? [], ...raster.map((r) => r?.gruppen ?? []), alsSchicht);
    const tage = [...gr.flatMap((g) => g.tage), ...erkannteTermine.map((t) => t.tag)].sort();
    if (!tage.length) return null;
    return { gruppen: gr, termine: ics?.termine ?? 0, von: tage[0] ?? null, bis: tage[tage.length - 1] ?? null, einfach: ics?.einfach ?? 0 };
  }, [ics, raster, erkannteTermine, terminWahl]);
  const gruppen = useMemo(() => gelesen?.gruppen ?? [], [gelesen]);
  const ziele = useMemo<Record<string, Ziel>>(
    () => Object.fromEntries(gruppen.map((g) => [g.name, ueberschrieben[g.name] ?? schlageVor(g, arten)])),
    [gruppen, ueberschrieben, arten],
  );
  const gruppeNach = useMemo(() => new Map(gruppen.map((g) => [g.name, g])), [gruppen]);

  const artVon = (ref: string) => {
    if (ref.startsWith("neu:")) {
      const g = gruppeNach.get(ref.slice(4));
      return g ? neueArtAus(g, [], 0, 0).art : "arbeit";
    }
    return artNach.get(ref)?.art ?? "arbeit";
  };
  const plan = useMemo(
    () => planeImport(gruppen, ziele, vorhanden, modus, artVon),
    // artVon hängt nur von gruppeNach und artNach ab
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gruppen, ziele, vorhanden, modus, gruppeNach, artNach],
  );

  function aendereBild(id: number, teil: Partial<Bild>) {
    setBilder((alle) => alle.map((b) => (b.id === id ? { ...b, ...teil } : b)));
  }

  async function dateienGewaehlt(liste: File[]) {
    if (!liste.length) return;
    const dieserLauf = ++lauf.current;
    setGestartet(true);
    setSchritt(0);
    setFehler(null);
    setHinweis(null);
    setIcs(null);
    setBilder([]);
    setUeberschrieben({});
    setTerminWahl({});
    for (const u of urls.current.splice(0)) URL.revokeObjectURL(u);
    setDateiname(liste.length === 1 ? liste[0]!.name : `${liste.length} Dateien`);

    // Egal welche Endung: Es zählt, ob eine Kalender-Datei oder ein Bild drinsteckt.
    const texte: string[] = [];
    const bildDateien: File[] = [];
    const andere: string[] = [];
    for (const d of liste) {
      if (d.type.startsWith("image/") || /\.(png|jpe?g|heic|heif|gif|webp)$/i.test(d.name)) {
        if (d.size > MAX_BILD_BYTES) andere.push(d.name);
        else bildDateien.push(d);
        continue;
      }
      if (d.size > MAX_BYTES) {
        andere.push(d.name);
        continue;
      }
      try {
        const text = await d.text();
        if (/BEGIN:VCALENDAR/i.test(text)) texte.push(text);
        else andere.push(d.name);
      } catch {
        andere.push(d.name);
      }
    }
    if (!texte.length && !bildDateien.length) {
      setFehler("In dieser Auswahl ist keine Kalender-Datei und kein Bild. Gesucht ist eine Datei aus dem Export deiner Schicht-App (meist .ics) oder ein Screenshot.");
      return;
    }
    if (andere.length) {
      setHinweis(`${andere.length === 1 ? "1 Datei" : `${andere.length} Dateien`} übersprungen (kein Kalender, kein Bild oder zu groß): ${andere.slice(0, 3).join(", ")}${andere.length > 3 ? " …" : ""}`);
    }
    if (texte.length) {
      try {
        // Mehrere Kalender-Dateien werden wie eine gelesen.
        const erg = leseIcs(texte.join("\n"));
        if (!erg.gruppen.length) setFehler("In den Kalender-Dateien sind keine Termine mit Datum zu finden.");
        else setIcs(erg);
      } catch (e) {
        setFehler(e instanceof IcsFehler ? e.message : "Die Kalender-Dateien konnten nicht gelesen werden.");
      }
    }

    // Screenshots nacheinander lesen (das Handy hat nur einen Prozessor für die Texterkennung).
    const heute = heuteInBerlin();
    const neueBilder: Bild[] = bildDateien.map((d, i) => {
      const url = URL.createObjectURL(d);
      urls.current.push(url);
      return {
        id: i + 1,
        name: d.name,
        vorschau: url,
        status: "liest",
        anteil: 0,
        woerter: [],
        gitter: null,
        jahr: Number(heute.slice(0, 4)),
        monat: Number(heute.slice(5, 7)),
        quelle: null,
      };
    });
    setBilder(neueBilder);
    for (const [i, d] of bildDateien.entries()) {
      const id = i + 1;
      try {
        const r = await erkenneScreenshot(d, (anteil) => {
          if (lauf.current === dieserLauf) aendereBild(id, { anteil });
        });
        if (lauf.current !== dieserLauf) return;
        // Erst Monat und Jahr (Überschrift, sonst aus den Wochentagen), dann die Einträge.
        const m = bestimmeMonat(r.woerter, heute, r.gitter);
        aendereBild(id, {
          status: "fertig",
          anteil: 1,
          woerter: r.woerter,
          gitter: r.gitter,
          quelle: m?.quelle ?? null,
          ...(m ? { jahr: m.jahr, monat: m.monat } : {}),
        });
      } catch (e) {
        if (lauf.current !== dieserLauf) return;
        aendereBild(id, { status: "fehler", fehler: e instanceof Error ? e.message : "Das Bild konnte nicht gelesen werden." });
      }
    }
  }

  async function zurVorschau() {
    if (!gelesen?.von || !gelesen.bis) return;
    setFehler(null);
    setArbeitet(true);
    try {
      // Jahr für Jahr laden, damit auch lange Zeiträume unter dem Zeilenlimit bleiben.
      const alle: Record<string, TagEintrag> = {};
      for (let j = Number(gelesen.von.slice(0, 4)); j <= Number(gelesen.bis.slice(0, 4)); j++) {
        Object.assign(alle, await ladeTage(`${j}-01-01`, `${j}-12-31`));
      }
      setVorhanden(alle);
      geladenFuer.current = `${gelesen.von.slice(0, 4)}-${gelesen.bis.slice(0, 4)}`;
      setSchritt(1);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden.");
    } finally {
      setArbeitet(false);
    }
  }

  async function uebernehmen() {
    setFehler(null);
    setArbeitet(true);
    try {
      const benutzt = new Set(plan.zeilen.map((z) => z.ref));
      const vergeben = arten.map((a) => a.kuerzel);
      const neu = gruppen
        .filter((g) => ziele[g.name]?.art === "neu" && benutzt.has(`neu:${g.name}`))
        .map((g, i) => {
          const eingabe = neueArtAus(g, vergeben, arten.length, i);
          vergeben.push(eingabe.kuerzel);
          return eingabe;
        });
      setErgebnis(await fuehreAus(plan, neu, vorhanden));
      const ids: string[] = [];
      for (const t of termineZuUebernehmen) {
        ids.push(
          await speichereTermin({
            id: null,
            datum: t.tag,
            bisDatum: null,
            titel: t.titel,
            ganztaegig: !t.beginn,
            von: t.beginn,
            bis: t.beginn ? t.ende || plusStunde(t.beginn) : "",
            wiederholung: "nie",
            notiz: "",
            ort: "",
            erinnerung: null,
          }),
        );
      }
      setTermineAngelegt(ids);
      await ladeArtenNeu();
      setSchritt(2);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht übernommen werden.");
    } finally {
      setArbeitet(false);
    }
  }

  async function rueckgaengig() {
    if (!ergebnis) return;
    setFehler(null);
    setArbeitet(true);
    try {
      await macheRueckgaengig(ergebnis);
      for (const id of termineAngelegt) await loescheTermin(id);
      await ladeArtenNeu();
      setZurueck(true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht rückgängig gemacht werden.");
    } finally {
      setArbeitet(false);
    }
  }

  // Von einem Knopf im Kalender mitgebrachte Dateien gleich lesen.
  // (Die Dateien bleiben in einem Merker, falls die Seite im Entwicklungsmodus ein zweites Mal startet.)
  const mitgebracht = useRef<File[] | null>(null);
  useEffect(() => {
    mitgebracht.current ??= holeImportDateien();
    if (mitgebracht.current.length) void dateienGewaehlt(mitgebracht.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sind alle Dateien gelesen, geht es von selbst zum Prüfen.
  const fertigGelesen = gestartet && !bilder.some((b) => b.status === "liest");
  useEffect(() => {
    if (schritt !== 0 || !fertigGelesen || !gelesen || weiterLaeuft.current) return;
    weiterLaeuft.current = true;
    void zurVorschau().finally(() => {
      weiterLaeuft.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schritt, fertigGelesen, gelesen]);

  // Wechselt jemand beim Prüfen den Monat in ein anderes Jahr, den Kalender dafür nachladen.
  const jahrSchluessel = gelesen?.von && gelesen.bis ? `${gelesen.von.slice(0, 4)}-${gelesen.bis.slice(0, 4)}` : "";
  useEffect(() => {
    if (schritt !== 1 || !jahrSchluessel || geladenFuer.current === jahrSchluessel) return;
    geladenFuer.current = jahrSchluessel;
    const [von, bis] = jahrSchluessel.split("-").map(Number) as [number, number];
    let aus = false;
    void (async () => {
      const alle: Record<string, TagEintrag> = {};
      try {
        for (let j = von; j <= bis; j++) Object.assign(alle, await ladeTage(`${j}-01-01`, `${j}-12-31`));
        if (!aus) setVorhanden(alle);
      } catch {
        // der Hinweis „Kalender konnte nicht geladen werden“ kommt beim Übernehmen
      }
    })();
    return () => {
      aus = true;
    };
  }, [schritt, jahrSchluessel]);

  const knopf = "rounded-xl bg-brand-500 px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-50";
  const knopfLeise = "rounded-xl bg-ink/[0.06] px-5 py-3 text-[15px] font-semibold";
  const q = QUELLEN.find((x) => x.id === quelle)!;

  // Vorschau: Monate im Zeitraum, die ersten zwei zeigen wir.
  const vorschauMonate = useMemo(() => {
    if (!gelesen?.von || !gelesen.bis) return [];
    const liste: { jahr: number; monat: number }[] = [];
    let j = Number(gelesen.von.slice(0, 4));
    let m = Number(gelesen.von.slice(5, 7)) - 1;
    const bj = Number(gelesen.bis.slice(0, 4));
    const bm = Number(gelesen.bis.slice(5, 7)) - 1;
    while ((j < bj || (j === bj && m <= bm)) && liste.length < 600) {
      liste.push({ jahr: j, monat: m });
      if (++m > 11) {
        m = 0;
        j++;
      }
    }
    return liste;
  }, [gelesen]);

  const neuPlan = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of plan.zeilen) m.set(`${z.tag}|${z.ebene}`, z.ref);
    return m;
  }, [plan]);
  const farbeFuer = (ref: string | undefined) => {
    if (!ref) return null;
    if (ref.startsWith("neu:")) {
      const g = gruppeNach.get(ref.slice(4));
      return g ? neueArtAus(g, [], arten.length, 0) : null;
    }
    return artNach.get(ref) ?? null;
  };

  const fertigSchichten = plan.geschrieben;
  const zuEnde = schritt === 2 && ergebnis;
  const chipText = (ziel: Ziel | undefined) => {
    if (!ziel || ziel.art === "skip") return "Überspringen";
    if (ziel.art === "neu") return "Neue Schicht";
    return `${artNach.get(ziel.id)?.name ?? "Schicht"} ✓`;
  };
  const kopfTitel = (() => {
    if (!bilder.length || !gelesen) return null;
    const monate = [...new Set(bilder.filter((b) => b.status === "fertig").map((b) => `${MONATE[b.monat - 1]} ${b.jahr}`))];
    return monate.length === 1 ? `${monate[0]} erkannt` : monate.length > 1 ? `${monate.length} Monate erkannt` : null;
  })();
  const uebernehmenText =
    arbeitet
      ? "Wird übernommen …"
      : [
          fertigSchichten ? `${fertigSchichten} ${fertigSchichten === 1 ? "Tag" : "Tage"}` : "",
          termineZuUebernehmen.length ? `${termineZuUebernehmen.length} ${termineZuUebernehmen.length === 1 ? "Termin" : "Termine"}` : "",
        ]
          .filter(Boolean)
          .join(" und ") + " übernehmen";

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Plan hochladen"
        unter="Aus einer anderen App in deinen Kalender"
        rechts={
          <Link href="/privat" aria-label="Zurück zum Kalender" className="glas flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />
      {!zuEnde ? <Fortschritt schritt={schritt} /> : null}

      <input
        ref={eingabe}
        type="file"
        multiple
        className="sr-only"
        aria-label="Kalender-Dateien oder Screenshots"
        onChange={(e) => {
          void dateienGewaehlt(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {schritt === 0 ? (
        <>
          <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-brand-500 to-[#4a3fd6] p-5 text-white shadow-[0_16px_36px_rgba(47,91,234,0.35)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/20">
              <Upload className="h-6 w-6" />
            </span>
            <h2 className="mt-3.5 text-[21px] font-bold leading-tight tracking-[-0.01em]">Schon einen Plan in einer anderen App?</h2>
            <p className="mt-2 text-[14.5px] leading-snug text-white/85">
              Mach einen Screenshot deiner Monatsansicht und lade ihn hoch. ShiftNexo erkennt Monat, Schichten und Termine für dich.
            </p>
            <button
              type="button"
              onClick={() => eingabe.current?.click()}
              disabled={bilder.some((b) => b.status === "liest")}
              className="mt-4 h-[54px] w-full rounded-[18px] bg-white text-[16px] font-bold text-brand-700 disabled:opacity-60"
            >
              Screenshot hochladen
            </button>
            <button
              type="button"
              onClick={() => eingabe.current?.click()}
              className="mt-2.5 h-11 w-full rounded-[16px] border-2 border-white/45 text-[14.5px] font-semibold"
            >
              Kalender-Datei (.ics) wählen
            </button>
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-white/80">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Das Bild wird nur auf deinem Handy gelesen und nicht hochgeladen.
            </p>
          </section>

          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
          {hinweis ? <Alert tone="warning">{hinweis}</Alert> : null}
          {fertigGelesen && !gelesen && !fehler ? (
            <Alert tone="warning">
              Auf dem Bild habe ich keinen Kalender mit Einträgen erkannt. Mach den Screenshot von der Monatsansicht, in der die Namen
              oder Kürzel der Schichten zu sehen sind – oder nimm eine Kalender-Datei.
            </Alert>
          ) : null}

          {bilder.length ? (
            <PrivatKarte titel="Wird gelesen">
              <ul className="space-y-2 px-4 py-4" aria-label="Screenshots">
                {bilder.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-[16px] bg-ink/[0.05] p-3" data-bild={b.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.vorschau} alt="" className="h-14 w-11 shrink-0 rounded-lg object-cover object-top" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{b.name}</p>
                      {b.status === "liest" ? (
                        <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {b.anteil > 0 ? `Wird gelesen … ${Math.round(b.anteil * 100)} %` : "Texterkennung startet … beim ersten Mal lädt sie etwa 5 MB"}
                        </p>
                      ) : null}
                      {b.status === "fehler" ? <p className="text-[13px] text-crit-fg">{b.fehler}</p> : null}
                      {b.status === "fertig" ? <p className="text-[13px] text-ink-muted">Fertig gelesen</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </PrivatKarte>
          ) : null}

          <PrivatKarte titel="So einfach geht es">
            <ol className="space-y-3 px-4 py-4">
              {[
                ["Screenshot machen.", "Öffne deine alte App im Monat und mach ein Bild je Monat."],
                ["Alle Bilder auf einmal wählen.", "Der Monat wird automatisch erkannt."],
                ["Kurz prüfen und übernehmen.", "Du siehst vorher, was in deinen Kalender kommt."],
              ].map(([fett, rest], i) => (
                <li key={fett} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[14px] font-bold text-brand-700">{i + 1}</span>
                  <p className="pt-0.5 text-[14.5px] leading-snug">
                    <b className="font-semibold">{fett}</b> {rest}
                  </p>
                </li>
              ))}
            </ol>
          </PrivatKarte>

          <details className="glas rounded-[22px] px-4 py-3">
            <summary className="cursor-pointer text-[14.5px] font-semibold">Du hast eine Kalender-Datei (.ics)? So kommst du an sie</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quelle">
                {QUELLEN.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={quelle === x.id}
                    onClick={() => setQuelle(x.id)}
                    className={cn("rounded-[14px] px-3 py-2.5 text-[14px] font-semibold", quelle === x.id ? "bg-brand-500 text-white" : "bg-ink/[0.06]")}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
              <ol className="list-decimal space-y-1.5 pl-5 text-[14px] text-ink-muted">
                {q.anleitung.map((a) => (
                  <li key={a}>{a.replace("im nächsten Schritt", "oben")}</li>
                ))}
              </ol>
              <p className="text-[12px] text-ink-faint">Menünamen können je nach Version der App abweichen.</p>
            </div>
          </details>
        </>
      ) : null}

      {schritt === 1 && gelesen ? (
        <>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">{kopfTitel ?? "Plan gelesen"}</h2>
              <p className="mt-0.5 text-[14px] text-ink-muted">
                {[
                  bilder.length ? `Aus ${bilder.length} ${bilder.length === 1 ? "Screenshot" : "Screenshots"}` : ics ? "Aus der Kalender-Datei" : "",
                  `${gruppen.length} ${gruppen.length === 1 ? "Schicht" : "Schichten"}`,
                  erkannteTermine.length ? `${erkannteTermine.length} ${erkannteTermine.length === 1 ? "Termin" : "Termine"}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                .
              </p>
            </div>
          </div>

          {bilder.map((b, i) => {
            const r = raster[i];
            const jahre = Array.from({ length: 4 }, (_, k) => Number(heuteInBerlin().slice(0, 4)) - 1 + k);
            return (
              <div key={b.id} className="glas space-y-2 rounded-[18px] px-3.5 py-3" data-bild={b.name}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-muted">{bilder.length > 1 ? `Bild ${i + 1}` : "Falscher Monat?"}</span>
                  <select
                    aria-label={`Monat von ${b.name}`}
                    className="ml-auto min-w-0 rounded-[10px] bg-ink/[0.06] px-2.5 py-2 text-[14px]"
                    value={b.monat}
                    onChange={(e) => aendereBild(b.id, { monat: Number(e.target.value) })}
                  >
                    {MONATE.map((m, k) => (
                      <option key={m} value={k + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Jahr von ${b.name}`}
                    className="rounded-[10px] bg-ink/[0.06] px-2.5 py-2 text-[14px]"
                    value={b.jahr}
                    onChange={(e) => aendereBild(b.id, { jahr: Number(e.target.value) })}
                  >
                    {jahre.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
                {b.quelle === "kopf-ohne-jahr" ? (
                  <p className="text-[12.5px] text-ink-muted">Das Jahr stand nicht dabei – aus den Wochentagen ergänzt. Bitte kurz prüfen.</p>
                ) : b.quelle === "raster" ? (
                  <Alert tone="warning">Keine Überschrift gefunden – Monat aus den Wochentagen geschätzt. Bitte prüfen.</Alert>
                ) : !b.quelle ? (
                  <Alert tone="warning">Monat und Jahr bitte selbst wählen.</Alert>
                ) : null}
                {r?.warnung ? <Alert tone="warning">{r.warnung}</Alert> : null}
              </div>
            );
          })}

          <PrivatKarte titel="So kommt es in deinen Kalender">
            <div className="space-y-4 px-4 py-4">
              {vorschauMonate.slice(0, 2).map(({ jahr, monat }) => (
                <div key={`${jahr}-${monat}`}>
                  <h3 className="mb-1 text-[14px] font-semibold">
                    {MONATE[monat]} {jahr}
                  </h3>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-faint">
                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {monatsRaster(jahr, monat).map((tag, i) => {
                      if (!tag) return <span key={`l${i}`} />;
                      const neuArt = farbeFuer(neuPlan.get(`${tag}|1`));
                      const alt = vorhanden[tag]?.schicht ? artNach.get(vorhanden[tag]!.schicht!) : null;
                      const zeige = neuArt ?? alt ?? null;
                      return (
                        <span
                          key={tag}
                          data-tag={tag}
                          className={cn(
                            "flex h-9 flex-col items-center justify-center rounded-lg text-[11px] leading-none",
                            !zeige && "bg-ink/[0.04] text-ink-muted",
                            zeige && !neuArt && "opacity-60",
                          )}
                          style={zeige ? farbStil(zeige.farbe) : undefined}
                        >
                          <span className="text-[10px] opacity-70">{Number(tag.slice(8))}</span>
                          <span className="font-bold">{zeige?.kuerzel ?? ""}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {vorschauMonate.length > 2 ? (
                <p className="text-[12.5px] text-ink-muted">
                  Gezeigt sind die ersten zwei Monate – insgesamt {vorschauMonate.length} Monate werden übernommen. Blasse Tage bleiben, wie sie sind.
                </p>
              ) : null}
            </div>
          </PrivatKarte>

          <PrivatKarte titel="Schichten">
            <ul className="divide-y divide-line px-4 pb-2">
              {gruppen.map((g: Gruppe) => {
                const ziel = ziele[g.name];
                const art = ziel?.art === "vorhanden" ? artNach.get(ziel.id) : ziel?.art === "neu" ? neueArtAus(g, [], arten.length, 0) : null;
                return (
                  <li key={g.name} className="flex items-center gap-3 py-3">
                    <span
                      className={cn("flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold", !art && "bg-ink/10 text-ink-muted")}
                      style={art ? farbStil(art.farbe) : undefined}
                    >
                      {art?.kuerzel ?? "–"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{g.name}</div>
                      <div className="text-[12.5px] text-ink-muted">
                        {g.tage.length} {g.tage.length === 1 ? "Tag" : "Tage"}
                        {!g.ganztaegig && g.beginn ? ` · ${g.beginn}–${g.ende}` : ""}
                      </div>
                    </div>
                    <select
                      aria-label={`Zuordnung für ${g.name}`}
                      title={chipText(ziel)}
                      className={cn(
                        "h-10 max-w-[44%] shrink-0 rounded-[12px] px-2.5 text-[13px] font-semibold",
                        ziel?.art === "vorhanden" ? "bg-ok-bg text-ok-fg" : ziel?.art === "neu" ? "bg-brand-500/15 text-brand-700" : "bg-ink/[0.06] text-ink-muted",
                      )}
                      value={ziel?.art === "vorhanden" ? ziel.id : (ziel?.art ?? "skip")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUeberschrieben((z) => ({
                          ...z,
                          [g.name]: v === "neu" ? { art: "neu" } : v === "skip" ? { art: "skip" } : { art: "vorhanden", id: v },
                        }));
                      }}
                    >
                      {arten.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ✓
                        </option>
                      ))}
                      <option value="neu">Neue Schicht</option>
                      <option value="skip">Überspringen</option>
                    </select>
                  </li>
                );
              })}
            </ul>
            <p className="px-4 pb-3 text-[12.5px] leading-snug text-ink-muted">
              Neue Schichten legt die App für dich an. Namen, Farbe und Uhrzeit änderst du später unter „Schichten“. Screenshots werden mit
              einer Texterkennung gelesen und sind nie ganz sicher – prüf die Zuordnung kurz.
            </p>
          </PrivatKarte>

          {erkannteTermine.length ? (
            <PrivatKarte titel="Termine">
              <div className="space-y-2 px-4 py-4">
                <p className="text-[13px] text-ink-muted">
                  Was nach Termin aussieht (mit Uhrzeit oder nur einmal im Monat), kommt als Termin in deinen Kalender und nicht als Schicht.
                </p>
                <ul className="space-y-2">
                  {erkannteTermine.map((t) => {
                    const k = terminSchluessel(t);
                    const [, mm, tt] = t.tag.split("-");
                    return (
                      <li key={k} className="flex items-center gap-2 rounded-[14px] bg-ink/[0.04] px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold">{t.titel}</span>
                          <span className="block text-[12.5px] text-ink-muted">
                            {Number(tt)}.{Number(mm)}.{t.beginn ? ` · ${t.beginn}${t.ende ? `–${t.ende}` : ""} Uhr` : " · ganztägig"}
                          </span>
                        </span>
                        <select
                          aria-label={`Was ist „${t.titel}“?`}
                          className="shrink-0 rounded-[10px] bg-ink/[0.06] px-2.5 py-2 text-[14px]"
                          value={wahlVon(t)}
                          onChange={(e) => setTerminWahl((w) => ({ ...w, [k]: e.target.value as TerminWahl }))}
                        >
                          <option value="termin">Termin</option>
                          <option value="schicht">Ist eine Schicht</option>
                          <option value="weg">Weglassen</option>
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </PrivatKarte>
          ) : null}

          {plan.belegt > 0 ? (
            <PrivatKarte titel="Wenn an einem Tag schon etwas steht">
              <div className="space-y-1.5 px-4 py-4" role="radiogroup">
                {MODI.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2.5",
                      modus === m.id ? "bg-brand-500/15 ring-1 ring-brand-500/40" : "bg-ink/[0.05]",
                    )}
                  >
                    <input type="radio" name="modus" checked={modus === m.id} onChange={() => setModus(m.id)} className="mt-1 h-4 w-4 accent-brand-500" />
                    <span>
                      <span className="block text-[15px] font-medium">{m.text}</span>
                      <span className="block text-[13px] text-ink-muted">{m.hinweis}</span>
                    </span>
                  </label>
                ))}
                <p className="pt-1 text-[12.5px] text-ink-muted">
                  {plan.belegt} von {plan.tage} Tagen sind schon belegt.
                </p>
              </div>
            </PrivatKarte>
          ) : null}

          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
          <button
            type="button"
            className={cn(knopf, "h-14 w-full rounded-[18px] text-[16px] font-bold shadow-[0_10px_24px_rgba(47,91,234,0.35)]")}
            disabled={arbeitet || (plan.geschrieben === 0 && !termineZuUebernehmen.length)}
            onClick={() => void uebernehmen()}
          >
            {uebernehmenText}
          </button>
          <p className="text-center text-[12.5px] text-ink-muted">Danach kannst du alles mit „Rückgängig“ wieder zurücknehmen.</p>
          <button type="button" className={cn(knopfLeise, "w-full")} onClick={() => setSchritt(0)} disabled={arbeitet}>
            Anderes Bild wählen
          </button>
        </>
      ) : null}

      {zuEnde ? (
        <PrivatKarte>
          <div className="space-y-4 px-4 py-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
              {zurueck ? <Undo2 className="h-7 w-7" /> : <Check className="h-7 w-7" />}
            </span>
            <div>
              <h2 className="text-[20px] font-bold">
                {zurueck
                  ? "Rückgängig gemacht"
                  : [
                      ergebnis.geschrieben || !termineAngelegt.length ? `${ergebnis.geschrieben} ${ergebnis.geschrieben === 1 ? "Tag" : "Tage"}` : "",
                      termineAngelegt.length ? `${termineAngelegt.length} ${termineAngelegt.length === 1 ? "Termin" : "Termine"}` : "",
                    ]
                      .filter(Boolean)
                      .join(" + ") + " übernommen"}
              </h2>
              <p className="mt-1 text-[14px] text-ink-muted">
                {zurueck
                  ? "Dein Kalender ist wieder so wie vorher."
                  : ergebnis.angelegt.length
                    ? `Dazu ${ergebnis.angelegt.length === 1 ? "wurde 1 neue Schicht" : `wurden ${ergebnis.angelegt.length} neue Schichten`} angelegt.`
                    : "Schau im Kalender nach, ob alles stimmt."}
              </p>
            </div>
            {fehler ? <Alert tone="error">{fehler}</Alert> : null}
            <div className="flex flex-col gap-2">
              <Link href="/privat" className={cn(knopf, "block")}>
                Zum Kalender
              </Link>
              {!zurueck ? (
                <button type="button" className={knopfLeise} onClick={() => void rueckgaengig()} disabled={arbeitet}>
                  {arbeitet ? "Einen Moment …" : "Rückgängig"}
                </button>
              ) : null}
            </div>
          </div>
        </PrivatKarte>
      ) : null}
    </div>
  );
}
