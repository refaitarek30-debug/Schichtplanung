import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bilder für die Startseite: der Privatkalender, wie er in der App aussieht.
 * Rein statisch (kein JavaScript), mit festen Beispieldaten – Farben und
 * Formen wie im echten Kalender (Vorlagen aus `privat_konto_anlegen`).
 */

const DUNKEL = "#16181d";
export const ARTEN = {
  F: { name: "Früh", kurz: "F", farbe: "#F5A524", text: DUNKEL, zeit: "06:00–14:00" },
  S: { name: "Spät", kurz: "S", farbe: "#22A06B", text: DUNKEL, zeit: "14:00–22:00" },
  N: { name: "Nacht", kurz: "N", farbe: "#2F6FDE", text: "#fff", zeit: "22:00–06:00" },
  X: { name: "Frei", kurz: "X", farbe: "#E5484D", text: DUNKEL, zeit: "" },
  U: { name: "Urlaub", kurz: "U", farbe: "#9B59D0", text: "#fff", zeit: "" },
  K: { name: "Krank", kurz: "K", farbe: "#F76B15", text: DUNKEL, zeit: "" },
} as const;
type Kuerzel = keyof typeof ARTEN;

const stil = (k: Kuerzel): CSSProperties => ({ backgroundColor: ARTEN[k].farbe, color: ARTEN[k].text });

/** Die Schichtfolge der Beispiele: je 2 Früh, Spät, Nacht, dann 4 frei. */
export const FOLGE: Kuerzel[] = ["F", "F", "S", "S", "N", "N", "X", "X", "X", "X"];

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Kleines Kästchen wie im Kalender. */
function Chip({ k, className }: { k: Kuerzel; className?: string }) {
  return (
    <span className={cn("block overflow-hidden text-clip whitespace-nowrap rounded-[6px] py-[2px] text-center text-[9.5px] font-semibold leading-tight tracking-[-0.02em]", className)} style={stil(k)}>
      {ARTEN[k].name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Handy mit Monatsansicht                                             */
/* ------------------------------------------------------------------ */

// November 2026: Der Monat beginnt an einem Sonntag – das Raster startet
// am Montag, 26. Oktober, und läuft sechs Wochen.
const START_TAG = 26; // 26. Oktober
const TAGE_OKT = 31;
const HEUTE = 18; // Beispiel: heute ist der 18. November
const URLAUB = new Set([23, 24, 25, 26, 27]);

function tagImRaster(i: number) {
  const roh = START_TAG + i;
  if (roh <= TAGE_OKT) return { tag: roh, imMonat: false };
  const nov = roh - TAGE_OKT;
  if (nov <= 30) return { tag: nov, imMonat: true };
  return { tag: nov - 30, imMonat: false };
}

export function KalenderHandy({ className }: { className?: string }) {
  const zellen = Array.from({ length: 42 }, (_, i) => {
    const { tag, imMonat } = tagImRaster(i);
    let k: Kuerzel = FOLGE[i % FOLGE.length];
    if (imMonat && URLAUB.has(tag)) k = "U";
    return { i, tag, imMonat, k, feiertag: imMonat && tag === 1, heute: imMonat && tag === HEUTE, termin: imMonat && tag === 12 };
  });

  return (
    <div
      role="img"
      aria-label="Vorschau: Monatsansicht des Schichtkalenders mit Früh-, Spät- und Nachtschichten, freien Tagen und Urlaub"
      className={cn("relative mx-auto w-[300px] sm:w-[320px]", className)}
    >
      {/* Leuchten hinter dem Gerät */}
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-full opacity-70 [background:var(--glas-hinter)] [mask-image:radial-gradient(closest-side,black_55%,transparent)]" />
      <div
        aria-hidden
        className="rounded-[46px] border border-line bg-[rgb(22_24_29)] p-[9px] shadow-[0_30px_80px_-20px_rgba(31,41,77,0.45)]"
      >
        <div className="privat relative flex h-[600px] flex-col overflow-hidden rounded-[38px] px-2.5 pb-3 pt-3 sm:h-[640px]">
          {/* Dynamic Island */}
          <div className="mx-auto mb-2 h-[22px] w-[90px] shrink-0 rounded-full bg-[rgb(22_24_29)]" />
          <div className="flex items-end justify-between px-1.5">
            <p className="text-[24px] font-bold leading-none tracking-tight text-ink">
              November <span className="font-medium text-ink-muted">2026</span>
            </p>
            <span className="glas flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-ink-muted">
              TR
            </span>
          </div>
          <div className="glas mt-2.5 grid grid-cols-3 rounded-[12px] p-[3px] text-center text-[11.5px] font-semibold">
            <span className="py-1 text-ink-muted">Woche</span>
            <span className="rounded-[9px] bg-surface py-1 text-ink shadow-sm">Monat</span>
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
                className={cn(
                  "glas-linie flex min-h-0 flex-col gap-[2px] overflow-hidden border-t px-[2px] pt-[3px]",
                  z.i % 7 !== 0 && "border-l",
                  z.i % 7 >= 5 && "bg-ink/[0.025]",
                  !z.imMonat && "opacity-35",
                )}
              >
                <span
                  className={cn(
                    "tnum mx-auto flex h-[20px] min-w-[20px] items-center justify-center rounded-full text-[12px] leading-none",
                    z.heute
                      ? "bg-[#ff3b30] font-bold text-white shadow-[0_2px_8px_rgba(255,59,48,0.45)]"
                      : z.feiertag
                        ? "font-semibold text-[#e5484d]"
                        : "font-medium text-ink",
                  )}
                >
                  {z.tag}
                </span>
                <Chip k={z.k} />
                {z.feiertag ? <span className="truncate text-center text-[8px] leading-tight text-[#e5484d]">Feiertag</span> : null}
                {z.termin ? (
                  <span className="truncate text-[8.5px] leading-tight text-ink-muted">
                    <span className="mr-0.5 inline-block h-1 w-1 rounded-full bg-ink-faint align-middle" />
                    Zahnarzt
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          {/* Pinsel-Leiste */}
          <div className="glas mt-2.5 flex items-center gap-1.5 overflow-hidden rounded-[18px] px-2 py-2">
            {(["F", "S", "N", "X", "U", "K"] as Kuerzel[]).map((k, i) => (
              <span
                key={k}
                className={cn("flex h-9 min-w-0 flex-1 items-center justify-center rounded-[11px] text-[11px] font-semibold", i === 0 && "ring-2 ring-ink ring-offset-1 ring-offset-transparent")}
                style={stil(k)}
              >
                {ARTEN[k].name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kleine Bilder für die Funktionen                                    */
/* ------------------------------------------------------------------ */

function Rahmen({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div role="img" aria-label={label} className={cn("privat relative overflow-hidden rounded-[28px] border border-line p-5 sm:p-6", className)}>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Schichtfolge antippen – das Jahr ist gefüllt. */
export function RotationBild() {
  const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return (
    <Rahmen label="Eine Schichtfolge aus zehn Tagen füllt automatisch das ganze Jahr">
      <div className="glas rounded-[20px] p-3.5">
        <p className="text-[12px] font-semibold text-ink-muted">Deine Schichtfolge</p>
        <div className="mt-2 grid grid-cols-10 gap-1">
          {FOLGE.map((k, i) => (
            <span key={i} className="flex h-8 items-center justify-center rounded-[8px] text-[12px] font-bold" style={stil(k)}>
              {ARTEN[k].kurz}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[12px] bg-brand-500 px-3 py-2 text-[12.5px] font-semibold text-white">
          Eintragen bis Dezember 2027
          <span aria-hidden>→</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {monate.map((m, mi) => (
          <div key={m} className="glas rounded-[12px] p-1.5">
            <p className="text-[9.5px] font-semibold text-ink-muted">{m}</p>
            <div className="mt-1 grid grid-cols-7 gap-[2px]">
              {Array.from({ length: 28 }, (_, d) => (
                <span key={d} className="aspect-square rounded-[2px]" style={{ backgroundColor: ARTEN[FOLGE[(mi * 30 + d) % FOLGE.length]].farbe }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Rahmen>
  );
}

/** Du und dein Partner in einer Woche – gemeinsame freie Tage fallen sofort auf. */
export function PartnerBild() {
  const du: Kuerzel[] = ["S", "N", "N", "X", "X", "X", "X"];
  const partner: (Kuerzel | "arbeit" | "frei")[] = ["arbeit", "arbeit", "arbeit", "arbeit", "frei", "frei", "arbeit"];
  const tage = [16, 17, 18, 19, 20, 21, 22];
  return (
    <Rahmen label="Wochenansicht mit deinen Schichten und den Arbeitstagen deines Partners">
      <div className="glas rounded-[20px] p-3.5">
        <div className="grid grid-cols-[3.6rem_repeat(7,minmax(0,1fr))] items-center gap-1.5 text-center">
          <span />
          {tage.map((t, i) => (
            <span key={t} className="text-[10.5px] font-semibold text-ink-muted">
              {WT[i]}
              <span className="block text-[13px] text-ink">{t}</span>
            </span>
          ))}
          <span className="text-left text-[12px] font-semibold">Du</span>
          {du.map((k, i) => (
            <Chip key={i} k={k} className="py-1.5" />
          ))}
          <span className="text-left text-[12px] font-semibold">Partner</span>
          {partner.map((p, i) => (
            <span
              key={i}
              className={cn(
                "block truncate rounded-[6px] py-1.5 text-[10px] font-semibold leading-tight ring-[1.5px] ring-inset",
                p === "frei" ? "text-ink-muted ring-ink/20" : "text-brand-700 ring-brand-500/60",
              )}
            >
              {p === "frei" ? "frei" : "Arbeit"}
            </span>
          ))}
          <span />
          {du.map((k, i) => (
            <span key={i} className="flex justify-center">
              {k === "X" && partner[i] === "frei" ? <span className="h-1.5 w-6 rounded-full bg-[#22A06B]" /> : <span className="h-1.5" />}
            </span>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
          <span className="h-1.5 w-4 rounded-full bg-[#22A06B]" /> Freitag und Samstag habt ihr beide frei
        </p>
      </div>
      <div className="glas mt-3 flex items-center gap-3 rounded-[18px] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[13px] font-bold text-white">♥</span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Einladung per Link</p>
          <p className="truncate text-[12px] text-ink-muted">Kein Konto nötig – einfach öffnen.</p>
        </div>
      </div>
    </Rahmen>
  );
}

/** So erscheinen die Schichten im Kalender des Handys. */
export function AboBild() {
  const liste: { tag: string; k: Kuerzel }[] = [
    { tag: "Mo, 16. Nov.", k: "F" },
    { tag: "Di, 17. Nov.", k: "S" },
    { tag: "Mi, 18. Nov.", k: "N" },
  ];
  return (
    <Rahmen label="Schichten als Termine im Kalender des Handys und als Widget">
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <div className="glas space-y-2.5 rounded-[20px] p-3.5">
          <p className="text-[12px] font-semibold text-ink-muted">Kalender</p>
          {liste.map((e) => (
            <div key={e.tag}>
              <p className="text-[11px] font-semibold text-ink-faint">{e.tag}</p>
              <div className="mt-1 flex items-stretch gap-2 rounded-[10px] bg-surface/70 p-2">
                <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: ARTEN[e.k].farbe }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{ARTEN[e.k].name}</p>
                  <p className="text-[11.5px] text-ink-muted">{ARTEN[e.k].zeit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="glas flex aspect-square w-[118px] flex-col justify-between rounded-[24px] p-3 sm:w-[132px]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#ff3b30]">Heute</p>
          <div>
            <p className="text-[20px] font-bold leading-none">Nacht</p>
            <p className="mt-1 text-[11px] text-ink-muted">22:00–06:00</p>
          </div>
          <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: ARTEN.N.farbe }} />
        </div>
      </div>
    </Rahmen>
  );
}

/** Auswertung: Schichten, Stunden, Überstunden. */
export function AuswertungBild() {
  const zaehlen: { k: Kuerzel; n: number }[] = [
    { k: "F", n: 6 },
    { k: "S", n: 6 },
    { k: "N", n: 4 },
    { k: "U", n: 5 },
  ];
  return (
    <Rahmen label="Auswertung mit gezählten Schichten, Stunden und Überstunden">
      <div className="glas rounded-[20px] p-3.5">
        <p className="text-[12px] font-semibold text-ink-muted">November · Schichten zählen</p>
        <div className="mt-2.5 space-y-2">
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
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Ist", wert: "168 h" },
          { label: "Soll", wert: "161 h" },
          { label: "Überstunden", wert: "+7 h", gut: true },
        ].map((s) => (
          <div key={s.label} className="glas rounded-[16px] px-3 py-2.5">
            <p className="text-[11px] text-ink-muted">{s.label}</p>
            <p className={cn("tnum mt-0.5 text-[18px] font-bold", s.gut && "text-ok-fg")}>{s.wert}</p>
          </div>
        ))}
      </div>
    </Rahmen>
  );
}
