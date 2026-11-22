"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, CircleHelp, Plus, X } from "lucide-react";
import { useSession } from "@/context/session";
import { Blatt } from "@/components/privat/blatt";
import { fetchMyShiftPlan } from "@/lib/data/rotation";
import {
  ladeTausch,
  tauschAnbieten,
  tauschAnnehmen,
  tauschEntscheiden,
  tauschZurueckziehen,
  type Tausch,
} from "@/lib/data/tausch";
import { cn } from "@/lib/utils";

/**
 * Schichttausch unter Kollegen – so einfach wie möglich:
 *  1. „Schicht anbieten“: eigenen Tag antippen, fertig.
 *  2. Wer an dem Tag frei hat, tippt „Übernehmen“ (auf Wunsch mit Gegentag).
 *  3. Die Leitung bestätigt – erst dann ändert sich der Plan.
 * Jede Karte sagt in einem Satz, was als Nächstes passiert.
 */

const tagText = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

const heuteIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface MeinTag {
  iso: string;
  schicht: string;
}

export function TauschSeite() {
  const { mode, role } = useSession();
  const fuehrung = role === "admin" || role === "shift_leader";
  const [liste, setListe] = useState<Tausch[] | null | undefined>(undefined);
  const [meineTage, setMeineTage] = useState<MeinTag[]>([]);
  const [anbieten, setAnbieten] = useState(false);
  const [uebernehmen, setUebernehmen] = useState<Tausch | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ton: "ok" | "fehler"; text: string } | null>(null);

  const laden = useCallback(async () => {
    if (mode !== "live") return setListe([]);
    setListe(await ladeTausch());
    try {
      const plan = await fetchMyShiftPlan(heuteIso(), 60);
      setMeineTage(plan.filter((t) => !t.isFree && t.shiftName).map((t) => ({ iso: t.date, schicht: t.shiftName! })));
    } catch {
      setMeineTage([]);
    }
  }, [mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  const tun = async (id: string, aktion: () => Promise<void>, erfolg: string) => {
    setLaeuft(id);
    setMeldung(null);
    try {
      await aktion();
      setMeldung({ ton: "ok", text: erfolg });
      await laden();
      return true;
    } catch (e) {
      setMeldung({ ton: "fehler", text: e instanceof Error ? e.message : "Das hat nicht geklappt." });
      return false;
    } finally {
      setLaeuft(null);
    }
  };

  const gruppen = useMemo(() => {
    const l = liste ?? [];
    return {
      zuEntscheiden: fuehrung ? l.filter((t) => t.status === "angefragt") : [],
      angebote: l.filter((t) => t.status === "offen" && !t.vonIch),
      meine: l.filter((t) => (t.vonIch || t.uebernehmerIch) && !(fuehrung && t.status === "angefragt" && !t.vonIch && !t.uebernehmerIch)),
      erledigt: fuehrung ? l.filter((t) => (t.status === "genehmigt" || t.status === "abgelehnt") && !t.vonIch && !t.uebernehmerIch) : [],
    };
  }, [liste, fuehrung]);

  if (liste === undefined) return <p className="px-1 text-[14px] text-ink-muted">wird geladen …</p>;
  if (liste === null) {
    return (
      <p className="rounded-2xl bg-surface-muted px-4 py-4 text-[14px] text-ink-muted" data-tausch-bald>
        Der Schichttausch wird gerade eingerichtet und ist in Kürze da.
      </p>
    );
  }

  return (
    <div className="space-y-5" data-tausch>
      {/* So geht's – kurz, immer sichtbar. */}
      <ol className="grid grid-cols-3 gap-1.5" data-tausch-anleitung>
        {[
          ["1", "Anbieten", "Tag antippen, den du abgibst"],
          ["2", "Übernehmen", "wer frei hat, tippt darauf"],
          ["3", "Leitung bestätigt", "dann ändert sich der Plan"],
        ].map(([n, titel, text]) => (
          <li key={n} className="rounded-2xl bg-surface px-2.5 py-2.5 shadow-card ring-1 ring-line">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{n}</span>
            <span className="mt-1.5 block text-[13px] font-semibold leading-tight">{titel}</span>
            <span className="block text-[11.5px] leading-snug text-ink-muted">{text}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => {
          setMeldung(null);
          setAnbieten(true);
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-[15px] font-semibold text-white active:scale-[0.99]"
        data-tausch-anbieten
      >
        <Plus className="h-5 w-5" strokeWidth={2.4} /> Schicht zum Tausch anbieten
      </button>

      {meldung ? (
        <p
          role="status"
          className={cn("rounded-2xl px-4 py-3 text-[14px]", meldung.ton === "ok" ? "bg-ok-bg text-ok-fg" : "bg-crit-bg text-crit-fg")}
          data-tausch-meldung
        >
          {meldung.text}
        </p>
      ) : null}

      {gruppen.zuEntscheiden.length ? (
        <Abschnitt titel="Wartet auf deine Bestätigung" daten="entscheiden">
          {gruppen.zuEntscheiden.map((t) => (
            <Karte key={t.id} t={t}>
              <p className="text-[13.5px]">
                <b>{t.uebernehmerName}</b> übernimmt die Schicht von <b>{t.vonName}</b>
                {t.gegenTag ? (
                  <>
                    {" "}– dafür arbeitet {t.vonName} am <b>{tagText(t.gegenTag)}</b> ({t.gegenSchicht})
                  </>
                ) : null}
                .
              </p>
              <div className="flex gap-2">
                <Knopf
                  laeuft={laeuft === t.id}
                  onClick={() => tun(t.id, () => tauschEntscheiden(t.id, true), "Bestätigt – der Plan ist geändert.")}
                  daten="bestaetigen"
                >
                  <Check className="h-4 w-4" strokeWidth={2.4} /> Bestätigen
                </Knopf>
                <Knopf
                  rand
                  laeuft={laeuft === t.id}
                  onClick={() => tun(t.id, () => tauschEntscheiden(t.id, false), "Abgelehnt. Beide bekommen Bescheid.")}
                >
                  <X className="h-4 w-4" strokeWidth={2.4} /> Ablehnen
                </Knopf>
              </div>
            </Karte>
          ))}
        </Abschnitt>
      ) : null}

      <Abschnitt titel="Angebote im Team" daten="angebote">
        {gruppen.angebote.length ? (
          gruppen.angebote.map((t) => (
            <Karte key={t.id} t={t}>
              <p className="text-[13.5px] text-ink-muted">
                Von <b className="text-ink">{t.vonName}</b>
                {t.notiz ? <> · „{t.notiz}“</> : null}
              </p>
              {t.passt ? (
                <Knopf onClick={() => (setMeldung(null), setUebernehmen(t))} daten="uebernehmen">
                  <ArrowLeftRight className="h-4 w-4" strokeWidth={2.2} /> Übernehmen
                </Knopf>
              ) : (
                <p className="text-[12.5px] text-ink-faint">{t.grund ?? "Passt bei dir nicht."} – Übernehmen geht nur, wenn du frei hast.</p>
              )}
            </Karte>
          ))
        ) : (
          <Leer text="Gerade bietet niemand eine Schicht an. Sobald jemand etwas anbietet, steht es hier." />
        )}
      </Abschnitt>

      <Abschnitt titel="Meine Tausche" daten="meine">
        {gruppen.meine.length ? (
          gruppen.meine.map((t) => (
            <Karte key={t.id} t={t}>
              <p className="text-[13.5px]">{naechsterSchritt(t)}</p>
              {(t.status === "offen" && t.vonIch) || (t.status === "angefragt" && (t.vonIch || t.uebernehmerIch)) ? (
                <Knopf
                  rand
                  laeuft={laeuft === t.id}
                  onClick={() =>
                    tun(t.id, () => tauschZurueckziehen(t.id), t.vonIch ? "Angebot zurückgenommen." : "Du hast die Übernahme zurückgegeben.")
                  }
                  daten="zurueckziehen"
                >
                  {t.vonIch ? "Angebot zurücknehmen" : "Doch nicht übernehmen"}
                </Knopf>
              ) : null}
            </Karte>
          ))
        ) : (
          <Leer text="Du hast noch nichts angeboten oder übernommen." />
        )}
      </Abschnitt>

      {gruppen.erledigt.length ? (
        <Abschnitt titel="Zuletzt entschieden" daten="erledigt">
          {gruppen.erledigt.map((t) => (
            <Karte key={t.id} t={t}>
              <p className="text-[13px] text-ink-muted">
                {t.vonName} → {t.uebernehmerName}
              </p>
            </Karte>
          ))}
        </Abschnitt>
      ) : null}

      <details className="rounded-2xl bg-surface-muted px-4 py-3 text-[13.5px] leading-relaxed text-ink-muted" data-tausch-hilfe>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink">
          <CircleHelp className="h-4 w-4" /> Hängst du fest?
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>„Übernehmen“ erscheint nur, wenn du an dem Tag frei hast und keinen Urlaub hast.</li>
          <li>Ein Gegentag ist freiwillig: Dann arbeitet die andere Person dafür an einem deiner Tage.</li>
          <li>Solange die Leitung nicht bestätigt hat, kannst du alles zurücknehmen.</li>
          <li>Über jede Änderung bekommst du eine Benachrichtigung.</li>
          <li>Klappt etwas nicht, steht oben in Rot, warum – sonst frag deine Schichtleitung.</li>
        </ul>
      </details>

      {anbieten ? (
        <AnbietenBlatt
          tage={meineTage.filter((d) => !(liste ?? []).some((t) => t.vonIch && t.tag === d.iso && (t.status === "offen" || t.status === "angefragt")))}
          onClose={() => setAnbieten(false)}
          onAnbieten={async (iso, notiz) => {
            const ok = await tun("neu", () => tauschAnbieten(iso, notiz), `Angeboten: ${tagText(iso)}. Du bekommst Bescheid, sobald jemand übernimmt.`);
            if (ok) setAnbieten(false);
          }}
          laeuft={laeuft === "neu"}
        />
      ) : null}
      {uebernehmen ? (
        <UebernehmenBlatt
          t={uebernehmen}
          tage={meineTage.filter((d) => d.iso !== uebernehmen.tag)}
          onClose={() => setUebernehmen(null)}
          laeuft={laeuft === uebernehmen.id}
          onUebernehmen={async (gegen) => {
            const ok = await tun(
              uebernehmen.id,
              () => tauschAnnehmen(uebernehmen.id, gegen),
              "Angefragt! Jetzt muss nur noch die Leitung bestätigen – du bekommst Bescheid.",
            );
            if (ok) setUebernehmen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function naechsterSchritt(t: Tausch): string {
  if (t.status === "offen") return "Angeboten – wartet darauf, dass jemand übernimmt.";
  if (t.status === "angefragt")
    return t.vonIch
      ? `${t.uebernehmerName} möchte übernehmen${t.gegenTag ? ` und dir dafür den ${tagText(t.gegenTag)} geben` : ""}. Die Leitung bestätigt noch.`
      : `Du übernimmst${t.gegenTag ? ` und gibst dafür den ${tagText(t.gegenTag)} ab` : ""}. Die Leitung bestätigt noch.`;
  if (t.status === "genehmigt") return "Bestätigt – steht schon im Plan.";
  if (t.status === "abgelehnt") return "Von der Leitung abgelehnt.";
  return "Zurückgenommen.";
}

const STATUS: Record<Tausch["status"], { text: string; klasse: string }> = {
  offen: { text: "angeboten", klasse: "bg-brand-500/12 text-brand-700" },
  angefragt: { text: "wartet auf Leitung", klasse: "bg-warn-bg text-warn-fg" },
  genehmigt: { text: "bestätigt", klasse: "bg-ok-bg text-ok-fg" },
  abgelehnt: { text: "abgelehnt", klasse: "bg-crit-bg text-crit-fg" },
  zurueckgezogen: { text: "zurückgenommen", klasse: "bg-surface-muted text-ink-muted" },
};

function Abschnitt({ titel, daten, children }: { titel: string; daten: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" data-tausch-abschnitt={daten}>
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{titel}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Karte({ t, children }: { t: Tausch; children: React.ReactNode }) {
  const s = STATUS[t.status];
  return (
    <div className="space-y-2.5 rounded-2xl bg-surface px-4 py-3.5 shadow-card ring-1 ring-line" data-tausch-karte={t.status}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-semibold leading-tight">{tagText(t.tag)}</p>
          <p className="text-[13px] text-ink-muted">{t.schicht ?? "Schicht"}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold", s.klasse)}>{s.text}</span>
      </div>
      {children}
    </div>
  );
}

function Knopf({
  children,
  onClick,
  rand = false,
  laeuft = false,
  daten,
}: {
  children: React.ReactNode;
  onClick: () => void;
  rand?: boolean;
  laeuft?: boolean;
  daten?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laeuft}
      data-tausch-knopf={daten}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold disabled:opacity-60",
        rand ? "border border-line text-ink" : "bg-brand-600 text-white",
      )}
    >
      {laeuft ? "…" : children}
    </button>
  );
}

function Leer({ text }: { text: string }) {
  return <p className="rounded-2xl bg-surface-muted px-4 py-3.5 text-[13.5px] text-ink-muted">{text}</p>;
}

function TagWahl({ tage, wahl, onWahl }: { tage: MeinTag[]; wahl: string | null; onWahl: (iso: string | null) => void }) {
  if (!tage.length) {
    return <Leer text="In den nächsten 60 Tagen hast du keine Schicht, die du abgeben kannst." />;
  }
  return (
    <div className="grid max-h-[45dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3" data-tausch-tage>
      {tage.map((d) => (
        <button
          key={d.iso}
          type="button"
          onClick={() => onWahl(wahl === d.iso ? null : d.iso)}
          aria-pressed={wahl === d.iso}
          className={cn(
            "rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
            wahl === d.iso ? "bg-brand-600 text-white ring-brand-600" : "bg-surface ring-line hover:bg-surface-muted",
          )}
        >
          <span className="block text-[14px] font-semibold">{tagText(d.iso)}</span>
          <span className={cn("block truncate text-[12px]", wahl === d.iso ? "text-white/85" : "text-ink-muted")}>{d.schicht}</span>
        </button>
      ))}
    </div>
  );
}

function AnbietenBlatt({
  tage,
  onClose,
  onAnbieten,
  laeuft,
}: {
  tage: MeinTag[];
  onClose: () => void;
  onAnbieten: (iso: string, notiz: string) => void;
  laeuft: boolean;
}) {
  const [wahl, setWahl] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  return (
    <Blatt titel="Schicht anbieten" unter="Welchen Tag möchtest du abgeben?" onClose={onClose} wischZu="kopf">
      <div className="space-y-4 pb-1" data-tausch-anbieten-blatt>
        <TagWahl tage={tage} wahl={wahl} onWahl={setWahl} />
        <label className="block">
          <span className="text-[13px] font-medium text-ink-muted">Kurzer Grund (freiwillig)</span>
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value.slice(0, 200))}
            placeholder="z. B. Arzttermin"
            className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px]"
          />
        </label>
        <p className="text-[12.5px] text-ink-muted">Bitte keine Gesundheitsangaben – das sehen alle, die das Angebot sehen.</p>
        <button
          type="button"
          disabled={!wahl || laeuft}
          onClick={() => wahl && onAnbieten(wahl, notiz.trim())}
          className="h-12 w-full rounded-full bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-50"
          data-tausch-anbieten-ok
        >
          {laeuft ? "…" : wahl ? `${tagText(wahl)} anbieten` : "Erst oben einen Tag antippen"}
        </button>
      </div>
    </Blatt>
  );
}

function UebernehmenBlatt({
  t,
  tage,
  onClose,
  onUebernehmen,
  laeuft,
}: {
  t: Tausch;
  tage: MeinTag[];
  onClose: () => void;
  onUebernehmen: (gegen: string | null) => void;
  laeuft: boolean;
}) {
  const [mitGegentag, setMitGegentag] = useState(false);
  const [gegen, setGegen] = useState<string | null>(null);
  return (
    <Blatt titel={`${tagText(t.tag)} übernehmen`} unter={`${t.schicht ?? "Schicht"} von ${t.vonName}`} onClose={onClose} wischZu="kopf">
      <div className="space-y-4 pb-1" data-tausch-uebernehmen-blatt>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => (setMitGegentag(false), setGegen(null))}
            aria-pressed={!mitGegentag}
            className={cn("rounded-xl px-3 py-3 text-left ring-1", !mitGegentag ? "bg-brand-600 text-white ring-brand-600" : "ring-line")}
          >
            <span className="block text-[14px] font-semibold">Einfach übernehmen</span>
            <span className={cn("block text-[12px]", !mitGegentag ? "text-white/85" : "text-ink-muted")}>Du arbeitest zusätzlich</span>
          </button>
          <button
            type="button"
            onClick={() => setMitGegentag(true)}
            aria-pressed={mitGegentag}
            className={cn("rounded-xl px-3 py-3 text-left ring-1", mitGegentag ? "bg-brand-600 text-white ring-brand-600" : "ring-line")}
            data-tausch-gegentag
          >
            <span className="block text-[14px] font-semibold">Mit Gegentag</span>
            <span className={cn("block text-[12px]", mitGegentag ? "text-white/85" : "text-ink-muted")}>Du gibst dafür einen Tag ab</span>
          </button>
        </div>
        {mitGegentag ? (
          <>
            <p className="text-[13px] text-ink-muted">Welchen deiner Tage soll {t.vonName} dafür machen?</p>
            <TagWahl tage={tage} wahl={gegen} onWahl={setGegen} />
          </>
        ) : null}
        <button
          type="button"
          disabled={laeuft || (mitGegentag && !gegen)}
          onClick={() => onUebernehmen(mitGegentag ? gegen : null)}
          className="h-12 w-full rounded-full bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-50"
          data-tausch-uebernehmen-ok
        >
          {laeuft ? "…" : mitGegentag && !gegen ? "Erst einen Gegentag antippen" : "Ja, übernehmen"}
        </button>
        <p className="text-center text-[12px] text-ink-faint">Die Leitung bestätigt noch. Bis dahin kannst du es zurücknehmen.</p>
      </div>
    </Blatt>
  );
}
