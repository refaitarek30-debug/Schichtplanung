import type { CSSProperties, ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Cake,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Image as BildIcon,
  LayoutGrid,
  ListChecks,
  Repeat,
  Settings,
  Share2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Bildschirme für die Wisch-Show der Startseite: so sehen die Seiten in der
 * App aus – mit erfundenen Beispieldaten, ohne JavaScript, ohne Datenbank.
 * Handy: 300 × 640 px, PC: 800 × 500 px (verkleinert wird per CSS).
 */

/* ------------------------------------------------------------------ */
/* Gemeinsames                                                         */
/* ------------------------------------------------------------------ */

const DUNKEL = "#16181d";
/** Schichtarten des Privatkalenders (Vorlagen aus `privat_konto_anlegen`). */
const ARTEN = {
  F: { name: "Früh", kurz: "F", farbe: "#F5A524", text: DUNKEL, zeit: "06:00–14:00" },
  S: { name: "Spät", kurz: "S", farbe: "#22A06B", text: DUNKEL, zeit: "14:00–22:00" },
  N: { name: "Nacht", kurz: "N", farbe: "#2F6FDE", text: "#fff", zeit: "22:00–06:00" },
  X: { name: "Frei", kurz: "X", farbe: "#E5484D", text: DUNKEL, zeit: "" },
  U: { name: "Urlaub", kurz: "U", farbe: "#9B59D0", text: "#fff", zeit: "" },
} as const;
type P = keyof typeof ARTEN;
const stil = (k: P): CSSProperties => ({ backgroundColor: ARTEN[k].farbe, color: ARTEN[k].text });
const FOLGE: P[] = ["F", "F", "S", "S", "N", "N", "X", "X", "X", "X"];

/** Firmenkalender: Farben wie im Schichtplan (globals.css). */
type B = "F" | "S" | "N" | "U" | "K" | "V" | "";
const ZELLE: Record<B, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  K: "bg-shift-krank text-shift-krank-ink",
  V: "bg-shift-vtag text-shift-vtag-ink",
  "": "bg-surface-sunken text-ink-faint",
};
const NAME_B: Record<B, string> = { F: "Früh", S: "Spät", N: "Nacht", U: "Urlaub", K: "Krank", V: "V-Tag", "": "frei" };

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// November 2026 beginnt an einem Sonntag – das Raster startet am Montag, 26. Oktober.
function tagImRaster(i: number) {
  const roh = 26 + i;
  if (roh <= 31) return { tag: roh, imMonat: false };
  const nov = roh - 31;
  if (nov <= 30) return { tag: nov, imMonat: true };
  return { tag: nov - 30, imMonat: false };
}
const HEUTE = 18;

/** Rahmen eines Handy-Bildschirms mit Statusleiste. */
function Handy({ children, className, glas = true }: { children: ReactNode; className?: string; glas?: boolean }) {
  return (
    <div className={cn("privat-schrift flex h-full flex-col overflow-hidden text-ink", glas ? "privat" : "bg-surface-muted", className)}>
      <div className="flex h-[44px] shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1" aria-hidden>
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
            ))}
          </span>
          <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-ink/60 p-[1px]">
            <span className="block h-full w-[70%] rounded-[1px] bg-ink" />
          </span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-4">{children}</div>
    </div>
  );
}

function Titel({ children, rechts }: { children: ReactNode; rechts?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1.5 pb-2 pt-1">
      <p className="text-[24px] font-bold leading-none tracking-tight">{children}</p>
      {rechts}
    </div>
  );
}

function Karte({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glas rounded-[18px] p-3", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Privat – Handy                                                      */
/* ------------------------------------------------------------------ */

export function PrivatMonat() {
  const zellen = Array.from({ length: 42 }, (_, i) => {
    const { tag, imMonat } = tagImRaster(i);
    let k: P = FOLGE[i % FOLGE.length];
    if (imMonat && tag >= 23 && tag <= 27) k = "U";
    return { i, tag, imMonat, k, heute: imMonat && tag === HEUTE, termin: imMonat && tag === 12 };
  });
  return (
    <Handy>
      <Titel rechts={<span className="glas flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-ink-muted">TR</span>}>
        November <span className="font-medium text-ink-muted">2026</span>
      </Titel>
      <div className="glas grid grid-cols-3 rounded-[12px] p-[3px] text-center text-[11.5px] font-semibold">
        <span className="py-1 text-ink-muted">Woche</span>
        <span className="rounded-[9px] bg-surface py-1 shadow-sm">Monat</span>
        <span className="py-1 text-ink-muted">Jahr</span>
      </div>
      <div className="glas mt-2.5 grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-hidden rounded-[20px]">
        {WT.map((w, i) => (
          <span key={w} className={cn("pb-0.5 pt-1 text-center text-[9.5px] font-semibold uppercase", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>
            {w}
          </span>
        ))}
        {zellen.map((z) => (
          <span
            key={z.i}
            className={cn("glas-linie flex min-h-0 flex-col gap-[2px] overflow-hidden border-t px-[2px] pt-[3px]", z.i % 7 !== 0 && "border-l", !z.imMonat && "opacity-35")}
          >
            <span
              className={cn(
                "tnum mx-auto flex h-[20px] min-w-[20px] items-center justify-center rounded-full text-[12px] leading-none",
                z.heute ? "bg-[#ff3b30] font-bold text-white" : "font-medium",
              )}
            >
              {z.tag}
            </span>
            <span className="block overflow-hidden whitespace-nowrap rounded-[6px] py-[2px] text-center text-[9.5px] font-semibold leading-tight" style={stil(z.k)}>
              {ARTEN[z.k].name}
            </span>
            {z.termin ? <span className="truncate text-[8.5px] leading-tight text-ink-muted">• Zahnarzt</span> : null}
          </span>
        ))}
      </div>
      <div className="glas mt-2.5 flex items-center gap-1.5 rounded-[18px] p-2">
        {(["F", "S", "N", "X", "U"] as P[]).map((k, i) => (
          <span key={k} className={cn("flex h-9 flex-1 items-center justify-center rounded-[11px] text-[11px] font-semibold", i === 0 && "ring-2 ring-ink ring-offset-1")} style={stil(k)}>
            {ARTEN[k].name}
          </span>
        ))}
      </div>
    </Handy>
  );
}

export function PrivatFolge() {
  const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return (
    <Handy>
      <Titel>Schichtfolge</Titel>
      <Karte>
        <p className="text-[12px] font-semibold text-ink-muted">10 Tage, wiederholt sich</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {FOLGE.map((k, i) => (
            <span key={i} className="flex h-11 flex-col items-center justify-center rounded-[10px] text-[13px] font-bold leading-none" style={stil(k)}>
              {ARTEN[k].kurz}
              <span className="mt-1 text-[8.5px] font-semibold opacity-75">Tag {i + 1}</span>
            </span>
          ))}
        </div>
      </Karte>
      <Karte className="mt-2.5 space-y-2 text-[13px]">
        <p className="flex justify-between">
          <span className="text-ink-muted">Beginnt am</span>
          <span className="font-semibold">Mo, 2. Nov. 2026</span>
        </p>
        <p className="flex justify-between border-t border-[var(--glas-linie)] pt-2">
          <span className="text-ink-muted">Eintragen bis</span>
          <span className="font-semibold">31. Dez. 2027</span>
        </p>
      </Karte>
      <div className="mt-2.5 rounded-[14px] bg-brand-500 py-3 text-center text-[14px] font-semibold text-white">Übernehmen</div>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 content-start gap-1.5">
        {monate.map((m, mi) => (
          <div key={m} className="glas rounded-[10px] p-1.5">
            <p className="text-[9px] font-semibold text-ink-muted">{m}</p>
            <div className="mt-0.5 grid grid-cols-7 gap-[2px]">
              {Array.from({ length: 28 }, (_, d) => (
                <span key={d} className="aspect-square rounded-[2px]" style={{ backgroundColor: ARTEN[FOLGE[(mi * 30 + d) % FOLGE.length]].farbe }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Handy>
  );
}

export function PrivatTag() {
  const stunden = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  return (
    <Handy>
      <Titel rechts={<span className="text-[13px] font-semibold text-brand-600">Heute</span>}>
        Mi, 18. <span className="font-medium text-ink-muted">Nov.</span>
      </Titel>
      <div className="flex items-center gap-2 rounded-[14px] px-3 py-2.5" style={stil("N")}>
        <span className="text-[15px] font-bold">Nacht</span>
        <span className="text-[12.5px] opacity-85">22:00–06:00</span>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-[#FF9F0A]/15 px-3 py-2 text-[12.5px] font-semibold text-[#b25e00]">
        <Cake className="h-4 w-4" aria-hidden /> Mama wird 60
      </div>
      <Karte className="relative mt-2.5 min-h-0 flex-1 overflow-hidden p-0">
        {stunden.map((h) => (
          <div key={h} className="flex h-[30px] items-start gap-2 border-t border-[var(--glas-linie)] px-2.5 first:border-t-0">
            <span className="tnum -mt-[1px] w-8 text-[10px] text-ink-faint">{String(h).padStart(2, "0")}:00</span>
          </div>
        ))}
        <div className="absolute left-12 right-2.5 top-[62px] h-[56px] rounded-[10px] border-l-[3px] border-brand-500 bg-brand-500/12 px-2.5 py-1.5">
          <p className="text-[12.5px] font-semibold">Zahnarzt</p>
          <p className="flex items-center gap-1 text-[10.5px] text-ink-muted">
            <Bell className="h-3 w-3" aria-hidden /> 1 Std. vorher
          </p>
        </div>
        <div className="absolute left-12 right-2.5 top-[182px] h-[40px] rounded-[10px] border-l-[3px] border-[#22A06B] bg-[#22A06B]/12 px-2.5 py-1.5">
          <p className="text-[12.5px] font-semibold">Training · jede Woche</p>
        </div>
      </Karte>
      <Karte className="mt-2.5 space-y-1.5 text-[13px]">
        <p className="text-[11.5px] font-semibold text-ink-muted">To-dos</p>
        <p className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-[1.5px] border-ink/30" /> Reifen wechseln
        </p>
        <p className="flex items-center gap-2 text-ink-faint line-through">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </span>
          Urlaub eintragen
        </p>
      </Karte>
    </Handy>
  );
}

export function PrivatPartner() {
  const du: P[] = ["S", "N", "N", "X", "X", "X", "F"];
  const lisa: P[] = ["F", "F", "F", "F", "X", "X", "F"];
  return (
    <Handy>
      <Titel>Teilen</Titel>
      <Karte className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF375F] text-[14px] font-bold text-white">L</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Lisa</p>
          <p className="text-[12px] text-ink-muted">Verbunden · sieht deine Schichten</p>
        </div>
        <ChevronRight className="h-4 w-4 text-ink-faint" aria-hidden />
      </Karte>
      <Karte className="mt-2.5">
        <p className="text-[12px] font-semibold text-ink-muted">Diese Woche</p>
        <div className="mt-2 grid grid-cols-[2.6rem_repeat(7,minmax(0,1fr))] items-center gap-1 text-center">
          <span />
          {WT.map((w, i) => (
            <span key={w} className="text-[10px] font-semibold text-ink-muted">
              {w}
              <span className="block text-[12px] text-ink">{16 + i}</span>
            </span>
          ))}
          <span className="text-left text-[11.5px] font-semibold">Du</span>
          {du.map((k, i) => (
            <span key={i} className="rounded-[6px] py-1.5 text-[10px] font-bold" style={stil(k)}>
              {ARTEN[k].kurz}
            </span>
          ))}
          <span className="text-left text-[11.5px] font-semibold">Lisa</span>
          {lisa.map((k, i) => (
            <span key={i} className="rounded-[6px] py-1.5 text-[10px] font-bold" style={stil(k)}>
              {ARTEN[k].kurz}
            </span>
          ))}
          <span />
          {du.map((k, i) => (
            <span key={i} className="flex justify-center">
              {k === "X" && lisa[i] === "X" ? <span className="h-1.5 w-5 rounded-full bg-[#22A06B]" /> : <span className="h-1.5" />}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12px] font-medium text-ink-muted">Fr und Sa habt ihr beide frei.</p>
      </Karte>
      <Karte className="mt-2.5 space-y-2.5">
        <p className="text-[12px] font-semibold text-ink-muted">Gruppe „Familie“</p>
        {[
          ["M", "Mama", "#5E5CE6"],
          ["J", "Jonas", "#30B0C7"],
        ].map(([a, n, f]) => (
          <p key={n} className="flex items-center gap-2.5 text-[13.5px] font-medium">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: f }}>
              {a}
            </span>
            {n}
          </p>
        ))}
      </Karte>
      <div className="mt-auto rounded-[14px] bg-brand-500 py-3 text-center text-[14px] font-semibold text-white">Person einladen</div>
    </Handy>
  );
}

export function PrivatAbo() {
  const liste: { tag: string; k: P }[] = [
    { tag: "Montag, 16. November", k: "S" },
    { tag: "Dienstag, 17. November", k: "N" },
    { tag: "Mittwoch, 18. November", k: "N" },
  ];
  return (
    <Handy glas={false}>
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="flex aspect-square flex-col justify-between rounded-[22px] bg-surface p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#ff3b30]">Mittwoch</p>
          <div>
            <p className="text-[22px] font-bold leading-none">Nacht</p>
            <p className="mt-1 text-[11px] text-ink-muted">22:00–06:00</p>
          </div>
          <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: ARTEN.N.farbe }} />
        </div>
        <div className="flex aspect-square flex-col justify-between rounded-[22px] bg-surface p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Diese Woche</p>
          <div className="grid grid-cols-7 gap-[3px]">
            {(["S", "N", "N", "X", "X", "X", "F"] as P[]).map((k, i) => (
              <span key={i} className="h-7 rounded-[4px]" style={{ backgroundColor: ARTEN[k].farbe }} />
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">3 Schichten</p>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] text-ink-faint">Widgets auf dem Home-Bildschirm</p>
      <div className="mt-3 min-h-0 flex-1 rounded-[22px] bg-surface p-3 shadow-sm">
        <p className="text-[20px] font-bold">Kalender</p>
        <div className="mt-2 space-y-3">
          {liste.map((e) => (
            <div key={e.tag}>
              <p className="text-[11px] font-semibold text-ink-faint">{e.tag}</p>
              <div className="mt-1 flex items-stretch gap-2 rounded-[10px] bg-surface-muted p-2">
                <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ARTEN[e.k].farbe }} />
                <div>
                  <p className="text-[13px] font-semibold">{ARTEN[e.k].name}</p>
                  <p className="text-[11.5px] text-ink-muted">{ARTEN[e.k].zeit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-ok-dot" /> Kalender-Abo aktualisiert sich selbst
      </p>
    </Handy>
  );
}

export function PrivatAuswertung() {
  const zaehlen: { k: P; n: number }[] = [
    { k: "F", n: 6 },
    { k: "S", n: 6 },
    { k: "N", n: 4 },
    { k: "U", n: 5 },
  ];
  return (
    <Handy>
      <Titel>Auswertung</Titel>
      <div className="glas grid grid-cols-2 rounded-[12px] p-[3px] text-center text-[11.5px] font-semibold">
        <span className="rounded-[9px] bg-surface py-1 shadow-sm">November</span>
        <span className="py-1 text-ink-muted">Jahr 2026</span>
      </div>
      <Karte className="mt-2.5">
        <p className="text-[12px] font-semibold text-ink-muted">Schichten</p>
        <div className="mt-2.5 space-y-2.5">
          {zaehlen.map(({ k, n }) => (
            <div key={k} className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 rounded-[6px] py-[3px] text-center text-[11px] font-semibold" style={stil(k)}>
                {ARTEN[k].name}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                <span className="block h-full rounded-full" style={{ width: `${(n / 7) * 100}%`, backgroundColor: ARTEN[k].farbe }} />
              </span>
              <span className="tnum w-5 text-right text-[13px] font-semibold">{n}</span>
            </div>
          ))}
        </div>
      </Karte>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          { label: "Ist", wert: "168 h" },
          { label: "Soll", wert: "161 h" },
          { label: "Plus", wert: "+7 h", gut: true },
        ].map((s) => (
          <Karte key={s.label} className="px-3 py-2.5">
            <p className="text-[11px] text-ink-muted">{s.label}</p>
            <p className={cn("tnum mt-0.5 text-[18px] font-bold", s.gut && "text-ok-fg")}>{s.wert}</p>
          </Karte>
        ))}
      </div>
      <Karte className="mt-2.5 space-y-2 text-[13px]">
        <p className="flex justify-between">
          <span className="text-ink-muted">Nachtschichten im Jahr</span>
          <span className="tnum font-semibold">52</span>
        </p>
        <p className="flex justify-between border-t border-[var(--glas-linie)] pt-2">
          <span className="text-ink-muted">Urlaubstage übrig</span>
          <span className="tnum font-semibold">9 von 30</span>
        </p>
        <p className="flex justify-between border-t border-[var(--glas-linie)] pt-2">
          <span className="text-ink-muted">Feiertage gearbeitet</span>
          <span className="tnum font-semibold">3</span>
        </p>
      </Karte>
    </Handy>
  );
}

export function PrivatImport() {
  return (
    <Handy>
      <Titel>Übernehmen</Titel>
      <p className="px-1.5 text-[13px] leading-snug text-ink-muted">Deine Schichten aus einer anderen App – ohne alles neu einzutippen.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Karte className="flex flex-col items-center gap-1.5 py-4 text-center">
          <FileText className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="text-[12.5px] font-semibold">Kalenderdatei</p>
          <p className="text-[10.5px] text-ink-muted">.ics und mehr</p>
        </Karte>
        <Karte className="flex flex-col items-center gap-1.5 py-4 text-center ring-2 ring-brand-500">
          <BildIcon className="h-6 w-6 text-brand-600" aria-hidden />
          <p className="text-[12.5px] font-semibold">Screenshot</p>
          <p className="text-[10.5px] text-ink-muted">wird erkannt</p>
        </Karte>
      </div>
      <Karte className="mt-2.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ok-fg">
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> November 2026 erkannt
        </p>
        <div className="mt-2 grid grid-cols-7 gap-[3px]">
          {Array.from({ length: 35 }, (_, i) => {
            const leer = i < 6 || i > 35;
            return <span key={i} className={cn("h-6 rounded-[4px]", leer && "opacity-20")} style={{ backgroundColor: ARTEN[FOLGE[i % FOLGE.length]].farbe }} />;
          })}
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">22 Schichten gefunden · Früh, Spät, Nacht</p>
      </Karte>
      <Karte className="mt-2.5 space-y-2 text-[13px]">
        <p className="flex items-center justify-between">
          Früh <span className="text-ink-muted">→ deine Schicht „Früh“</span>
        </p>
        <p className="flex items-center justify-between border-t border-[var(--glas-linie)] pt-2">
          N <span className="text-ink-muted">→ deine Schicht „Nacht“</span>
        </p>
      </Karte>
      <div className="mt-auto rounded-[14px] bg-brand-500 py-3 text-center text-[14px] font-semibold text-white">22 Schichten übernehmen</div>
    </Handy>
  );
}

/* ------------------------------------------------------------------ */
/* Betrieb – Handy                                                     */
/* ------------------------------------------------------------------ */

const MEINE: B[] = ["F", "F", "S", "S", "N", "N", "", "", "", ""];

export function BetriebKalender() {
  const zellen = Array.from({ length: 35 }, (_, i) => {
    const { tag, imMonat } = tagImRaster(i + 7);
    let k: B = MEINE[i % MEINE.length];
    if (imMonat && tag >= 23 && tag <= 27) k = "U";
    return { i, tag, imMonat, k, heute: imMonat && tag === HEUTE };
  });
  return (
    <Handy glas={false} className="relative">
      {/* Mitteilung von oben */}
      <div className="absolute left-2.5 right-2.5 top-[46px] z-10 flex items-center gap-2.5 rounded-[18px] bg-surface/95 p-2.5 shadow-[0_10px_30px_-8px_rgba(17,24,39,0.35)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-500 text-[11px] font-bold text-white">SN</span>
        <div className="min-w-0 flex-1">
          <p className="flex justify-between text-[12.5px] font-semibold">
            Urlaub genehmigt <span className="font-normal text-ink-faint">jetzt</span>
          </p>
          <p className="truncate text-[11.5px] text-ink-muted">23.–27. November · 5 Tage</p>
        </div>
      </div>
      <div className="mt-[64px]">
        <Titel>Mein Kalender</Titel>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-[3px] rounded-[18px] bg-surface p-1.5 shadow-sm">
        {WT.map((w) => (
          <span key={w} className="text-center text-[9.5px] font-semibold uppercase text-ink-faint">
            {w}
          </span>
        ))}
        {zellen.map((z) => (
          <span key={z.i} className={cn("flex flex-col items-center gap-[2px] pt-0.5", !z.imMonat && "opacity-35")}>
            <span className={cn("tnum flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[11px] font-medium", z.heute && "bg-[#ff3b30] font-bold text-white")}>
              {z.tag}
            </span>
            <span className={cn("flex w-full flex-1 items-center justify-center rounded-[6px] text-[10.5px] font-bold", ZELLE[z.k])}>{z.k || "·"}</span>
          </span>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Urlaub", "18"],
          ["V-Tage", "4"],
          ["Anträge", "1 offen"],
        ].map(([a, b]) => (
          <div key={a} className="rounded-[14px] bg-surface px-2 py-2 shadow-sm">
            <p className="text-[10.5px] text-ink-muted">{a}</p>
            <p className="text-[15px] font-bold">{b}</p>
          </div>
        ))}
      </div>
    </Handy>
  );
}

export function BetriebAntrag() {
  return (
    <Handy glas={false}>
      <Titel>Urlaub beantragen</Titel>
      <div className="space-y-2.5">
        <div className="rounded-[16px] bg-surface p-3 shadow-sm">
          <p className="text-[11.5px] font-semibold text-ink-muted">Art</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[12px] font-semibold">
            <span className="rounded-[10px] bg-shift-urlaub py-2 text-shift-urlaub-ink ring-2 ring-ink/70">Urlaub</span>
            <span className="rounded-[10px] bg-surface-muted py-2 text-ink-muted">V-Tag</span>
            <span className="rounded-[10px] bg-surface-muted py-2 text-ink-muted">Altersfrei</span>
          </div>
        </div>
        <div className="space-y-2 rounded-[16px] bg-surface p-3 text-[13.5px] shadow-sm">
          <p className="flex justify-between">
            <span className="text-ink-muted">Von</span> <span className="font-semibold">Mo, 23. Nov.</span>
          </p>
          <p className="flex justify-between border-t border-line pt-2">
            <span className="text-ink-muted">Bis</span> <span className="font-semibold">Fr, 27. Nov.</span>
          </p>
          <p className="flex justify-between border-t border-line pt-2">
            <span className="text-ink-muted">Arbeitstage</span> <span className="font-semibold">5</span>
          </p>
        </div>
        <div className="rounded-[16px] bg-surface p-3 shadow-sm">
          <p className="text-[11.5px] font-semibold text-ink-muted">Urlaubskonto</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[22px] font-bold">18</span>
            <span className="text-[13px] text-ink-muted">→ danach 13 von 30 Tagen</span>
          </div>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full w-[43%] rounded-full bg-shift-urlaub" />
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-[14px] bg-ok-bg px-3 py-2.5 text-[12.5px] font-semibold text-ok-fg">
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Besetzung bleibt in allen Schichten erfüllt
        </div>
      </div>
      <div className="mt-auto rounded-[14px] bg-brand-500 py-3 text-center text-[14px] font-semibold text-white">Antrag senden</div>
    </Handy>
  );
}

export function BetriebGenehmigen() {
  const offen = [
    { name: "Max Mustermann", was: "Urlaub · 23.–27. Nov.", ok: true },
    { name: "Erika Musterfrau", was: "V-Tag · Do, 19. Nov.", ok: false },
  ];
  return (
    <Handy glas={false}>
      <Titel rechts={<span className="rounded-full bg-crit-dot px-2 py-0.5 text-[11px] font-bold text-white">2</span>}>Anträge</Titel>
      <div className="space-y-2.5">
        {offen.map((a) => (
          <div key={a.name} className="rounded-[18px] bg-surface p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-[12px] font-semibold text-ink-muted">
                {a.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">{a.name}</p>
                <p className="text-[12px] text-ink-muted">{a.was}</p>
              </div>
            </div>
            <p className={cn("mt-2.5 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold", a.ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg")}>
              {a.ok ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
              {a.ok ? "Besetzung bleibt erfüllt" : "Spät fällt unter Soll (6 von 7)"}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-center text-[13px] font-semibold">
              <span className="rounded-[12px] bg-surface-muted py-2 text-ink-muted">Ablehnen</span>
              <span className="rounded-[12px] bg-brand-500 py-2 text-white">Genehmigen</span>
            </div>
          </div>
        ))}
        <div className="rounded-[18px] bg-surface p-3 text-[12.5px] shadow-sm">
          <p className="font-semibold">Zuletzt entschieden</p>
          <p className="mt-1.5 flex justify-between text-ink-muted">
            J. Becker · Urlaub <span className="font-semibold text-ok-fg">genehmigt</span>
          </p>
          <p className="mt-1 flex justify-between text-ink-muted">
            L. Schmitz · V-Tag <span className="font-semibold text-ok-fg">genehmigt</span>
          </p>
        </div>
      </div>
    </Handy>
  );
}

export function BetriebBesetzung() {
  const schichten = [
    { name: "Früh", zeit: "06–14", ist: 8, soll: 8, min: 7 },
    { name: "Spät", zeit: "14–22", ist: 6, soll: 7, min: 6 },
    { name: "Nacht", zeit: "22–06", ist: 4, soll: 6, min: 5 },
  ];
  return (
    <Handy glas={false}>
      <Titel rechts={<span className="text-[13px] font-semibold text-ink-muted">Do, 19.</span>}>Besetzung</Titel>
      <div className="space-y-2">
        {schichten.map((s) => {
          const art = s.ist >= s.soll ? "ok" : s.ist >= s.min ? "warn" : "crit";
          return (
            <div key={s.name} className="flex items-center gap-3 rounded-[16px] bg-surface p-3 shadow-sm">
              <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full", art === "ok" ? "bg-ok-dot" : art === "warn" ? "bg-warn-dot" : "bg-crit-dot")} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  {s.name} <span className="text-[12px] font-normal text-ink-faint">{s.zeit}</span>
                </p>
                <p className="text-[11.5px] text-ink-muted">
                  Soll {s.soll} · Mindestens {s.min}
                </p>
              </div>
              <span className="tnum text-[20px] font-bold">
                {s.ist}
                <span className="text-[13px] font-medium text-ink-faint">/{s.soll}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-[14px] bg-crit-bg px-3 py-2.5 text-[12.5px] font-semibold text-crit-fg">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden /> Nacht: 1 Person unter Mindestbesetzung
      </div>
      <div className="mt-2.5 rounded-[16px] bg-surface p-3 shadow-sm">
        <p className="text-[11.5px] font-semibold text-ink-muted">Qualifikationen in der Nacht</p>
        {[
          ["Ersthelfer", "2/1", true],
          ["Kranführer", "1/1", true],
          ["Elektrofachkraft", "0/1", false],
        ].map(([n, w, ok]) => (
          <p key={n as string} className="mt-2 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5">
              {ok ? <Check className="h-3.5 w-3.5 text-ok-fg" strokeWidth={2.5} aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5 text-warn-fg" aria-hidden />}
              {n}
            </span>
            <span className="tnum font-semibold">{w}</span>
          </p>
        ))}
      </div>
      <div className="mt-2.5 rounded-[16px] bg-surface p-3 shadow-sm">
        <p className="text-[11.5px] font-semibold text-ink-muted">Diese Woche</p>
        <div className="mt-2 grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] items-center gap-y-2 text-center">
          <span />
          {WT.map((w) => (
            <span key={w} className="text-[10px] font-semibold text-ink-faint">
              {w}
            </span>
          ))}
          {(
            [
              ["Früh", ["ok", "ok", "ok", "ok", "ok", "ok", "ok"]],
              ["Spät", ["ok", "ok", "ok", "warn", "ok", "warn", "ok"]],
              ["Nacht", ["ok", "ok", "ok", "crit", "ok", "ok", "ok"]],
            ] as [string, (keyof typeof PUNKT)[]][]
          ).map(([n, r]) => (
            <Wochenzeile key={n} name={n} r={r} />
          ))}
        </div>
      </div>
    </Handy>
  );
}

function Wochenzeile({ name, r }: { name: string; r: (keyof typeof PUNKT)[] }) {
  return (
    <>
      <span className="text-left text-[11.5px] font-semibold">{name}</span>
      {r.map((x, i) => (
        <span key={i} className="flex justify-center">
          <span className={cn("h-3 w-3 rounded-full", PUNKT[x])} />
        </span>
      ))}
    </>
  );
}

export function BetriebKonten() {
  const konten = [
    { name: "Urlaub", rest: 18, von: 30, farbe: "bg-shift-urlaub" },
    { name: "V-Tage", rest: 4, von: 6, farbe: "bg-shift-vtag" },
    { name: "Altersfreizeit", rest: 2, von: 3, farbe: "bg-brand-500" },
  ];
  return (
    <Handy glas={false}>
      <Titel>Meine Konten</Titel>
      <div className="space-y-2.5">
        {konten.map((k) => (
          <div key={k.name} className="rounded-[16px] bg-surface p-3 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">{k.name}</span>
              <span className="tnum text-[13px] text-ink-muted">
                <span className="text-[20px] font-bold text-ink">{k.rest}</span> von {k.von}
              </span>
            </div>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-sunken">
              <span className={cn("block h-full rounded-full", k.farbe)} style={{ width: `${(k.rest / k.von) * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-[16px] bg-surface p-3 shadow-sm">
        <p className="text-[11.5px] font-semibold text-ink-muted">Meine Anträge</p>
        {[
          ["Urlaub 23.–27. Nov.", "genehmigt", "text-ok-fg"],
          ["V-Tag 18. Dez.", "offen", "text-warn-fg"],
          ["Urlaub 2.–6. Aug.", "genehmigt", "text-ok-fg"],
        ].map(([a, s, f]) => (
          <p key={a} className="mt-2 flex justify-between text-[13px]">
            {a} <span className={cn("font-semibold", f)}>{s}</span>
          </p>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 rounded-[16px] bg-surface p-3 shadow-sm">
        <Share2 className="h-4 w-4 text-brand-600" aria-hidden />
        <p className="text-[13px] font-medium">Kalender mit Partner teilen</p>
        <ChevronRight className="ml-auto h-4 w-4 text-ink-faint" aria-hidden />
      </div>
    </Handy>
  );
}

/* ------------------------------------------------------------------ */
/* PC                                                                  */
/* ------------------------------------------------------------------ */

function Fenster({ menue, children, aktiv }: { menue: { icon: ReactNode; text: string; zahl?: number }[]; aktiv: number; children: ReactNode }) {
  return (
    <div className="privat-schrift flex h-full bg-surface text-ink">
      <aside className="flex w-[168px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface-muted p-3">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <span className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
        </div>
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-brand-500 text-[8px] font-bold text-white">SN</span>
          ShiftNexo
        </p>
        {menue.map((m, i) => (
          <span key={m.text} className={cn("flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px]", i === aktiv ? "bg-surface font-semibold shadow-sm" : "text-ink-muted")}>
            <span className={i === aktiv ? "text-brand-600" : ""}>{m.icon}</span>
            {m.text}
            {m.zahl ? <span className="ml-auto rounded-full bg-crit-dot px-1.5 text-[10px] font-bold text-white">{m.zahl}</span> : null}
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col p-4">{children}</div>
    </div>
  );
}

const ic = "h-3.5 w-3.5";

export function PcPrivat() {
  const zellen = Array.from({ length: 42 }, (_, i) => {
    const { tag, imMonat } = tagImRaster(i);
    let k: P = FOLGE[i % FOLGE.length];
    if (imMonat && tag >= 23 && tag <= 27) k = "U";
    return { i, tag, imMonat, k, heute: imMonat && tag === HEUTE };
  });
  return (
    <Fenster
      aktiv={0}
      menue={[
        { icon: <CalendarDays className={ic} />, text: "Kalender" },
        { icon: <Repeat className={ic} />, text: "Schichtfolge" },
        { icon: <ListChecks className={ic} />, text: "To-dos" },
        { icon: <BarChart3 className={ic} />, text: "Auswertung" },
        { icon: <Share2 className={ic} />, text: "Teilen" },
        { icon: <Upload className={ic} />, text: "Übernehmen" },
        { icon: <Settings className={ic} />, text: "Einstellungen" },
      ]}
    >
      <div className="flex items-center justify-between">
        <p className="text-[22px] font-bold tracking-tight">
          November <span className="font-medium text-ink-muted">2026</span>
        </p>
        <div className="grid grid-cols-3 rounded-[9px] bg-surface-muted p-[2px] text-center text-[11px] font-semibold">
          <span className="px-3 py-1 text-ink-muted">Woche</span>
          <span className="rounded-[7px] bg-surface px-3 py-1 shadow-sm">Monat</span>
          <span className="px-3 py-1 text-ink-muted">Jahr</span>
        </div>
      </div>
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-hidden rounded-[12px] border border-line">
        {WT.map((w) => (
          <span key={w} className="border-b border-line py-1 text-center text-[10px] font-semibold uppercase text-ink-faint">
            {w}
          </span>
        ))}
        {zellen.map((z) => (
          <span key={z.i} className={cn("flex flex-col gap-[3px] border-line p-[4px]", z.i % 7 !== 0 && "border-l", z.i >= 7 && "border-t", !z.imMonat && "opacity-35")}>
            <span className={cn("tnum flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px]", z.heute ? "bg-[#ff3b30] font-bold text-white" : "font-medium")}>{z.tag}</span>
            <span className="rounded-[5px] px-1 py-[2px] text-[10px] font-semibold" style={stil(z.k)}>
              {ARTEN[z.k].name}
              {ARTEN[z.k].zeit ? <span className="ml-1 font-normal opacity-80">{ARTEN[z.k].zeit.slice(0, 5)}</span> : null}
            </span>
          </span>
        ))}
      </div>
    </Fenster>
  );
}

const PLAN: { g: string; name: string; tage: B[] }[] = [
  { g: "A", name: "J. Becker", tage: ["F", "F", "S", "S", "N", "N", ""] },
  { g: "A", name: "L. Schmitz", tage: ["F", "F", "S", "S", "N", "N", ""] },
  { g: "B", name: "M. Wagner", tage: ["S", "S", "N", "N", "", "", "F"] },
  { g: "B", name: "Max Mustermann", tage: ["U", "U", "U", "U", "U", "", ""] },
  { g: "C", name: "T. Hoffmann", tage: ["N", "N", "", "", "F", "F", "S"] },
  { g: "C", name: "A. Yilmaz", tage: ["N", "K", "", "", "F", "F", "S"] },
  { g: "D", name: "R. Neumann", tage: ["", "", "F", "F", "S", "S", "N"] },
  { g: "D", name: "Erika Musterfrau", tage: ["", "", "F", "V", "S", "S", "N"] },
  { g: "D", name: "S. Krüger", tage: ["", "", "F", "F", "S", "S", "N"] },
  { g: "A", name: "P. Lehmann", tage: ["F", "U", "S", "S", "N", "N", ""] },
];
const BES: ("ok" | "warn" | "crit")[] = ["ok", "warn", "ok", "crit", "ok", "ok", "ok"];
const PUNKT = { ok: "bg-ok-dot", warn: "bg-warn-dot", crit: "bg-crit-dot" } as const;

export function PcBetrieb() {
  return (
    <Fenster
      aktiv={1}
      menue={[
        { icon: <LayoutGrid className={ic} />, text: "Übersicht" },
        { icon: <CalendarDays className={ic} />, text: "Schichtplan" },
        { icon: <FileText className={ic} />, text: "Anträge", zahl: 2 },
        { icon: <Users className={ic} />, text: "Mitarbeiter" },
        { icon: <BarChart3 className={ic} />, text: "Auswertung" },
        { icon: <Bell className={ic} />, text: "Mitteilungen" },
        { icon: <Settings className={ic} />, text: "Einstellungen" },
      ]}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[20px] font-bold tracking-tight">Schichtplan</p>
          <p className="text-[11.5px] text-ink-muted">KW 48 · 23.–29. November 2026</p>
        </div>
        <div className="flex gap-1 text-[11px] font-semibold">
          {["Alle", "A", "B", "C", "D"].map((g, i) => (
            <span key={g} className={cn("rounded-full px-2.5 py-1", i === 0 ? "bg-ink text-surface" : "bg-surface-muted text-ink-muted")}>
              {g}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-hidden rounded-[12px] border border-line">
          <div className="grid grid-cols-[150px_repeat(7,minmax(0,1fr))] gap-[3px] p-2 text-center text-[11px]">
            <span className="text-left text-[10px] font-semibold text-ink-faint">Gruppe · Name</span>
            {WT.map((t, i) => (
              <span key={t} className="text-[10px] font-semibold text-ink-faint">
                {t} {23 + i}
              </span>
            ))}
            {PLAN.map((z) => (
              <Zeile key={z.name} z={z} />
            ))}
            <span className="pt-1 text-left text-[10px] font-semibold text-ink-faint">Besetzung</span>
            {BES.map((b, i) => (
              <span key={i} className="flex justify-center pt-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", PUNKT[b])} />
              </span>
            ))}
          </div>
        </div>
        <div className="w-[170px] shrink-0 space-y-2">
          <div className="rounded-[12px] border border-line p-2.5">
            <p className="text-[11px] font-semibold">Offene Anträge</p>
            {["Max Mustermann · Urlaub", "Erika Musterfrau · V-Tag"].map((a) => (
              <p key={a} className="mt-1.5 truncate rounded-[8px] bg-surface-muted px-2 py-1.5 text-[10.5px]">
                {a}
              </p>
            ))}
          </div>
          <div className="rounded-[12px] border border-line p-2.5">
            <p className="text-[11px] font-semibold">Donnerstag</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-crit-fg">
              <TriangleAlert className="h-3 w-3" /> Spät: 1 zu wenig
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ok-fg">
              <Check className="h-3 w-3" strokeWidth={2.5} /> Früh, Nacht erfüllt
            </p>
          </div>
        </div>
      </div>
    </Fenster>
  );
}

function Zeile({ z }: { z: { g: string; name: string; tage: B[] } }) {
  return (
    <>
      <span className="flex items-center gap-1.5 truncate text-left text-[11px]">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-surface-sunken text-[9px] font-bold text-ink-muted">{z.g}</span>
        <span className="truncate">{z.name}</span>
      </span>
      {z.tage.map((k, i) => (
        <span key={i} title={NAME_B[k]} className={cn("flex h-[28px] items-center justify-center rounded-[6px] text-[11px] font-semibold", ZELLE[k])}>
          {k || "·"}
        </span>
      ))}
    </>
  );
}
