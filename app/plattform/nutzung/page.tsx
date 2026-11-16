import { konsoleZugang } from "@/lib/auth/konsole";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Seitenkopf } from "../tabelle";
import { ladeNutzung, type Nutzung } from "../daten";

export const metadata = { title: "Nutzung · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/**
 * Nutzung: Wachstum, Privatbereich und Zustand der Benachrichtigungen.
 *
 * Grenze: nur zusammengezählte Werte (platform_nutzung, Migration 0229) –
 * keine Namen, keine Inhalte, nichts je Person. Die Funktions-Zahlen gelten
 * nur für reine Privatkonten; für Betriebe wird hier nichts ausgewertet
 * (Auftragsverarbeitung: keine eigenen Analysezwecke).
 */
export default async function KonsoleNutzung() {
  const k = await konsoleZugang();
  const n = await ladeNutzung(k);
  return (
    <>
      <Seitenkopf
        titel="Nutzung"
        text="Zusammengezählte Zahlen – ohne Namen, ohne Inhalte, nichts je Person. Funktionen werden nur für reine Privatkonten gezählt; für Betriebe gibt es hier bewusst keine Auswertung."
      />
      {n ? (
        <>
          <Wachstum n={n} />
          <Verlauf n={n} />
          <Privat n={n} />
          <Technik n={n} />
        </>
      ) : (
        <p className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink-muted" data-nutzung-fehlt>
          Diese Seite braucht die Migration 0229 (supabase/migrations/0229_konsole_nutzung.sql). Sobald sie eingespielt ist, erscheinen hier die Zahlen.
        </p>
      )}
    </>
  );
}

const kurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** Neue Konten je Woche – zwei Reihen (privat, Betrieb) gestapelt, Zahl über dem Balken. */
function Wachstum({ n }: { n: Nutzung }) {
  const max = Math.max(1, ...n.wochen.map((w) => w.privat + w.betrieb));
  const summe = n.wochen.reduce((s, w) => s + w.privat + w.betrieb, 0);
  return (
    <Card>
      <CardHeader title="Neue Konten je Woche" hint={`${summe} in 12 Wochen`} />
      <CardBody>
        <div className="flex h-40 items-end gap-1.5" data-nutzung-wochen>
          {n.wochen.map((w) => {
            const g = w.privat + w.betrieb;
            return (
              <div key={w.woche} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`Woche ab ${kurz(w.woche)}: ${w.privat} privat, ${w.betrieb} Betrieb`}>
                <span className="tnum mb-1 text-[11px] text-ink-muted">{g || ""}</span>
                <div className="flex w-full max-w-[28px] flex-col gap-[2px]" style={{ height: `${(g / max) * 78}%` }}>
                  {w.betrieb ? <div className="rounded-t-[4px] bg-ink/35" style={{ flex: w.betrieb }} /> : null}
                  {w.privat ? <div className={w.betrieb ? "bg-brand-500" : "rounded-t-[4px] bg-brand-500"} style={{ flex: w.privat }} /> : null}
                </div>
                <span className="tnum mt-1.5 text-[10px] text-ink-faint">{kurz(w.woche)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex gap-4 text-[12px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-brand-500" /> privat
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-ink/35" /> mit Betrieb
          </span>
        </p>
      </CardBody>
    </Card>
  );
}

/** Aktive Konten über die Zeit – aus den Tagessummen. */
function Verlauf({ n }: { n: Nutzung }) {
  const v = n.verlauf;
  const max = Math.max(1, ...v.map((t) => t.aktiv_7));
  const letzter = v[v.length - 1];
  return (
    <Card>
      <CardHeader title="Aktiv in 7 Tagen – Verlauf" hint={letzter ? `heute ${letzter.aktiv_7} von ${letzter.konten} Konten` : undefined} />
      <CardBody>
        {v.length < 2 ? (
          <p className="text-sm text-ink-muted" data-nutzung-verlauf-leer>
            Der Verlauf beginnt heute. Ab jetzt kommt an jedem Tag, an dem die Konsole geöffnet wird, ein Punkt dazu (nur Summen).
          </p>
        ) : (
          <div className="flex h-28 items-end gap-[3px]" data-nutzung-verlauf>
            {v.map((t) => (
              <div key={t.tag} className="min-w-0 flex-1 rounded-t-[3px] bg-brand-500/80" style={{ height: `${Math.max(3, (t.aktiv_7 / max) * 100)}%` }} title={`${kurz(t.tag)}: ${t.aktiv_7} aktiv (davon ${t.privat_aktiv_7} privat) · ${t.aktiv_30} in 30 Tagen · ${t.konten} Konten`} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const FUNKTIONEN: { id: keyof Nutzung["privat"]["funktionen"]; text: string }[] = [
  { id: "schichtarten", text: "Eigene Schichten angelegt" },
  { id: "termine", text: "Termine" },
  { id: "todos", text: "To-dos" },
  { id: "teilen", text: "Kalender geteilt" },
  { id: "kalender_abo", text: "Kalender-Abo (Google/Apple)" },
  { id: "push", text: "Mitteilungen aufs Handy" },
];

function Privat({ n }: { n: Nutzung }) {
  const p = n.privat;
  const anteil = (x: number, von: number) => (von ? `${Math.round((x / von) * 100)} %` : "–");
  return (
    <Card>
      <CardHeader title="Privatbereich" hint={`${p.konten} reine Privatkonten`} />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-nutzung-privat>
          <Zahl label="Aktiv in 7 Tagen" wert={p.aktiv_7} zusatz={`${p.aktiv_30} in 30 Tagen`} />
          <Zahl label="Tragen Schichten ein" wert={p.mit_schichten} zusatz="Einträge in den letzten 30 Tagen" />
          <Zahl label="Planen voraus" wert={p.plant_voraus} zusatz="haben Schichten in der Zukunft" />
          <Zahl label="Kommen wieder" wert={anteil(p.wiederkehr, p.wiederkehr_basis)} zusatz={`${p.wiederkehr} von ${p.wiederkehr_basis} nach der 1. Woche`} />
        </div>
        <h3 className="mb-2 mt-5 text-[13px] font-semibold">Wie viele Konten nutzen was?</h3>
        <ul className="space-y-2" data-nutzung-funktionen>
          {FUNKTIONEN.map((f) => {
            const x = p.funktionen[f.id] ?? 0;
            return (
              <li key={f.id} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate">{f.text}</span>
                <span className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${p.konten ? (x / p.konten) * 100 : 0}%` }} />
                </span>
                <span className="tnum w-20 text-right text-ink-muted">
                  {x} von {p.konten}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
          Gezählt werden Konten, nicht Einträge. Lohn, Countdown und Urlaubsplaner liegen nur auf dem Gerät der Person und tauchen hier deshalb nicht auf.
        </p>
      </CardBody>
    </Card>
  );
}

function Technik({ n }: { n: Nutzung }) {
  const t = n.technik;
  return (
    <Card>
      <CardHeader title="Benachrichtigungen" hint="Zustand, nur Anzahl" />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-nutzung-technik>
          <Zahl label="Aufs Handy gesendet" wert={t.push_gesendet_24h} zusatz="in 24 Stunden" />
          <Zahl label="Hängen fest" wert={t.push_haengt} zusatz={t.push_haengt ? "seit über 1 Stunde nicht gesendet" : "alles raus"} warn={t.push_haengt > 0} />
          <Zahl label="E-Mail-Fehler" wert={t.mail_fehler_7} zusatz="in 7 Tagen" warn={t.mail_fehler_7 > 0} />
        </div>
      </CardBody>
    </Card>
  );
}

function Zahl({ label, wert, zusatz, warn }: { label: string; wert: number | string; zusatz: string; warn?: boolean }) {
  return (
    <div className="rounded-[14px] border border-line px-4 py-3">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className={`tnum mt-0.5 text-2xl font-semibold ${warn ? "text-warn-fg" : ""}`}>{wert}</p>
      <p className="mt-0.5 text-[12px] text-ink-faint">{zusatz}</p>
    </div>
  );
}
