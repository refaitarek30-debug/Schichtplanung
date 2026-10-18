"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, FileUp, Lock, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { farbStil, ladeTage, type TagEintrag } from "@/lib/privat/daten";
import { IcsFehler, leseIcs, MAX_BYTES, type Gruppe, type LeseErgebnis } from "@/lib/privat/ics-lesen";
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
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf } from "./rahmen";

const SCHRITTE = ["Quelle", "Datei", "Zuordnen", "Vorschau", "Fertig"];

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
  { id: "zusatz", text: "Als zweiten Eintrag ergänzen", hinweis: "Bleibt der erste Eintrag, kommt der neue dahinter." },
];

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const tagText = (tag: string) => {
  const [j, m, t] = tag.split("-");
  return `${Number(t)}.${Number(m)}.${j}`;
};

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
  const [dateiname, setDateiname] = useState("");
  const [gelesen, setGelesen] = useState<LeseErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ziele, setZiele] = useState<Record<string, Ziel>>({});
  const [vorhanden, setVorhanden] = useState<Record<string, TagEintrag>>({});
  const [modus, setModus] = useState<Modus>("leer");
  const [arbeitet, setArbeitet] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [zurueck, setZurueck] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);

  const gruppen = useMemo(() => gelesen?.gruppen ?? [], [gelesen]);
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

  async function dateiGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setGelesen(null);
    setDateiname(datei.name);
    if (datei.size > MAX_BYTES) {
      setFehler("Die Datei ist größer als 5 MB – das ist keine normale Kalender-Datei.");
      return;
    }
    try {
      const erg = leseIcs(await datei.text());
      if (!erg.gruppen.length) {
        setFehler("In der Datei sind keine Termine mit Datum zu finden.");
        return;
      }
      setGelesen(erg);
      setZiele(Object.fromEntries(erg.gruppen.map((g) => [g.name, schlageVor(g, arten)])));
    } catch (e) {
      setFehler(e instanceof IcsFehler ? e.message : "Die Datei konnte nicht gelesen werden.");
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
      setSchritt(3);
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
      await ladeArtenNeu();
      setSchritt(4);
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
      await ladeArtenNeu();
      setZurueck(true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht rückgängig gemacht werden.");
    } finally {
      setArbeitet(false);
    }
  }

  const knopf = "rounded-xl bg-brand-500 px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-50";
  const knopfLeise = "rounded-xl bg-ink/[0.06] px-5 py-3 text-[15px] font-semibold";
  const auswahlFeld = "w-full rounded-[12px] bg-ink/[0.06] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40";
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

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Schichten übernehmen"
        unter="Aus einer anderen App in deinen Kalender"
        rechts={
          <Link href="/privat/mehr" aria-label="Zurück zu Mehr" className="glas flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />
      <Fortschritt schritt={schritt} />

      {schritt === 0 ? (
        <PrivatKarte titel="Woher kommen deine Schichten?">
          <div className="space-y-3 px-4 py-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quelle">
              {QUELLEN.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={quelle === x.id}
                  onClick={() => setQuelle(x.id)}
                  className={cn(
                    "rounded-[16px] px-3 py-3 text-[15px] font-semibold",
                    quelle === x.id ? "bg-brand-500 text-white" : "bg-ink/[0.06]",
                  )}
                >
                  {x.name}
                </button>
              ))}
            </div>
            <div>
              <h3 className="mb-1.5 text-[14px] font-semibold">So kommst du an die Datei</h3>
              <ol className="list-decimal space-y-1.5 pl-5 text-[14px] text-ink-muted">
                {q.anleitung.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
              <p className="mt-2 text-[12px] text-ink-faint">Menünamen können je nach Version der App abweichen.</p>
            </div>
            <button type="button" className={cn(knopf, "w-full")} onClick={() => setSchritt(1)}>
              Weiter
            </button>
          </div>
        </PrivatKarte>
      ) : null}

      {schritt === 1 ? (
        <PrivatKarte titel="Kalender-Datei wählen">
          <div className="space-y-3 px-4 py-4">
            <input
              ref={eingabe}
              type="file"
              accept=".ics,text/calendar"
              className="sr-only"
              aria-label="Kalender-Datei (.ics)"
              onChange={(e) => {
                void dateiGewaehlt(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => eingabe.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-ink/20 px-4 py-7 text-center"
            >
              <FileUp className="h-7 w-7 text-brand-600" />
              <span className="text-[15px] font-semibold">{dateiname || "Datei auswählen"}</span>
              <span className="text-[13px] text-ink-muted">Endung .ics</span>
            </button>
            <p className="flex items-start gap-2 text-[13px] text-ink-muted">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              Die Datei wird nur auf deinem Handy gelesen und nicht hochgeladen. Gespeichert werden erst die Tage, die du im
              letzten Schritt bestätigst.
            </p>
            {fehler ? <Alert tone="error">{fehler}</Alert> : null}
            {gelesen ? (
              <Alert tone="success">
                {gelesen.termine} {gelesen.termine === 1 ? "Eintrag" : "Einträge"} gelesen
                {gelesen.von && gelesen.bis ? `, ${tagText(gelesen.von)} bis ${tagText(gelesen.bis)}` : ""}.
                {gelesen.einfach ? ` Bei ${gelesen.einfach} Wiederholungen wurde nur der erste Termin gelesen.` : ""}
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <button type="button" className={knopfLeise} onClick={() => setSchritt(0)}>
                Zurück
              </button>
              <button type="button" className={cn(knopf, "flex-1")} disabled={!gelesen} onClick={() => setSchritt(2)}>
                Weiter
              </button>
            </div>
          </div>
        </PrivatKarte>
      ) : null}

      {schritt === 2 ? (
        <PrivatKarte titel="Zuordnen">
          <div className="space-y-3 px-4 py-4">
            <p className="text-[14px] text-ink-muted">
              Welche deiner Schichten gehört zu welchem Namen aus der Datei? Wir haben schon einen Vorschlag gemacht.
            </p>
            <ul className="space-y-3">
              {gruppen.map((g: Gruppe) => (
                <li key={g.name} className="rounded-[16px] bg-ink/[0.04] p-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[15px] font-semibold">{g.name}</span>
                    <span className="shrink-0 text-[12px] text-ink-muted">
                      {g.tage.length} {g.tage.length === 1 ? "Tag" : "Tage"}
                      {!g.ganztaegig && g.beginn ? ` · ${g.beginn}–${g.ende}` : ""}
                    </span>
                  </div>
                  <select
                    aria-label={`Zuordnung für ${g.name}`}
                    className={auswahlFeld}
                    value={ziele[g.name]?.art === "vorhanden" ? (ziele[g.name] as { id: string }).id : (ziele[g.name]?.art ?? "skip")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setZiele((z) => ({
                        ...z,
                        [g.name]: v === "neu" ? { art: "neu" } : v === "skip" ? { art: "skip" } : { art: "vorhanden", id: v },
                      }));
                    }}
                  >
                    {arten.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.kuerzel})
                      </option>
                    ))}
                    <option value="neu">+ Neue Schicht anlegen</option>
                    <option value="skip">Überspringen</option>
                  </select>
                </li>
              ))}
            </ul>
            {fehler ? <Alert tone="error">{fehler}</Alert> : null}
            <div className="flex gap-2">
              <button type="button" className={knopfLeise} onClick={() => setSchritt(1)}>
                Zurück
              </button>
              <button
                type="button"
                className={cn(knopf, "flex-1")}
                disabled={arbeitet || !gruppen.some((g) => ziele[g.name] && ziele[g.name]!.art !== "skip")}
                onClick={() => void zurVorschau()}
              >
                {arbeitet ? "Einen Moment …" : "Weiter"}
              </button>
            </div>
          </div>
        </PrivatKarte>
      ) : null}

      {schritt === 3 ? (
        <PrivatKarte titel="Vorschau">
          <div className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { zahl: plan.tage, text: "Tage in der Datei" },
                { zahl: plan.belegt, text: "davon schon belegt" },
                { zahl: plan.geschrieben, text: "werden geschrieben" },
              ].map((k) => (
                <div key={k.text} className="rounded-[14px] bg-ink/[0.06] px-2 py-2.5">
                  <div className="tnum text-[20px] font-bold">{k.zahl}</div>
                  <div className="text-[11.5px] leading-tight text-ink-muted">{k.text}</div>
                </div>
              ))}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[14px] font-semibold">Wenn an einem Tag schon etwas steht</legend>
              <div className="space-y-1.5" role="radiogroup">
                {MODI.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2.5",
                      modus === m.id ? "bg-brand-500/15 ring-1 ring-brand-500/40" : "bg-ink/[0.05]",
                    )}
                  >
                    <input
                      type="radio"
                      name="modus"
                      checked={modus === m.id}
                      onChange={() => setModus(m.id)}
                      className="mt-1 h-4 w-4 accent-brand-500"
                    />
                    <span>
                      <span className="block text-[15px] font-medium">{m.text}</span>
                      <span className="block text-[13px] text-ink-muted">{m.hinweis}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

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
                Gezeigt sind die ersten zwei Monate – insgesamt {vorschauMonate.length} Monate werden übernommen. Blasse Tage
                bleiben, wie sie sind.
              </p>
            ) : null}

            {fehler ? <Alert tone="error">{fehler}</Alert> : null}
            <div className="flex gap-2">
              <button type="button" className={knopfLeise} onClick={() => setSchritt(2)} disabled={arbeitet}>
                Zurück
              </button>
              <button type="button" className={cn(knopf, "flex-1")} disabled={arbeitet || plan.geschrieben === 0} onClick={() => void uebernehmen()}>
                {arbeitet ? "Wird übernommen …" : `${plan.geschrieben} ${plan.geschrieben === 1 ? "Tag" : "Tage"} übernehmen`}
              </button>
            </div>
          </div>
        </PrivatKarte>
      ) : null}

      {schritt === 4 && ergebnis ? (
        <PrivatKarte>
          <div className="space-y-4 px-4 py-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
              {zurueck ? <Undo2 className="h-7 w-7" /> : <Check className="h-7 w-7" />}
            </span>
            <div>
              <h2 className="text-[20px] font-bold">
                {zurueck ? "Rückgängig gemacht" : `${ergebnis.geschrieben} ${ergebnis.geschrieben === 1 ? "Tag" : "Tage"} übernommen`}
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
