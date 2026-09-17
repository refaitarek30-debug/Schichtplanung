"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { TargetDeviation } from "@/components/report/target-deviation";
import { useSession } from "@/context/session";
import {
  DataError,
  fassenZusammen,
  fetchReport,
  MONATSNAMEN,
  type ReportRow,
  type ReportSummary,
} from "@/lib/data/report";
import { fetchCompanyRules } from "@/lib/data/staffing-rules";
import { cn } from "@/lib/utils";
import { Activity, CalendarCheck, Thermometer } from "lucide-react";

type Ebene = "gesamt" | "schicht" | "person";

/**
 * Auswertung von Ausfall, Anwesenheit und Gesundheitsrate.
 *
 * Die Datenbank liefert eine Zeile je Person und Monat; alle Ebenen
 * entstehen daraus durch Summieren. Die Raten werden dabei aus den
 * summierten Tagen neu gerechnet und nicht aus Einzelraten gemittelt –
 * ein Mittelwert würde jemanden mit fünf Arbeitstagen genauso stark
 * gewichten wie jemanden mit zwanzig.
 */
export default function AuswertungPage() {
  const { mode, role } = useSession();
  const jetzt = new Date();

  const [jahr, setJahr] = useState(jetzt.getFullYear());
  const [monat, setMonat] = useState<number | null>(null);
  const [ebene, setEbene] = useState<Ebene>("gesamt");
  const [zeilen, setZeilen] = useState<ReportRow[] | null>(null);
  const [ziel, setZiel] = useState(96);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (mode !== "live") return;
    setZeilen(null);
    setFehler(null);
    try {
      const [daten, regeln] = await Promise.all([
        fetchReport(jahr, monat),
        fetchCompanyRules(),
      ]);
      setZeilen(daten);
      setZiel(regeln.gesundheitsrateZiel);
    } catch (caught) {
      setZeilen([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Auswertung konnte nicht geladen werden.",
      );
    }
  }, [mode, jahr, monat]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const gesamt = useMemo(
    () => fassenZusammen(zeilen ?? [], () => ({ schluessel: "alle", bezeichnung: "Gesamtbetrieb" }))[0],
    [zeilen],
  );

  const gruppen = useMemo<ReportSummary[]>(() => {
    if (!zeilen) return [];
    if (ebene === "gesamt") return gesamt ? [gesamt] : [];
    if (ebene === "schicht") {
      return fassenZusammen(zeilen, (z) => ({
        schluessel: z.rotationTeam ?? "TS",
        bezeichnung: z.rotationTeam ? `${z.rotationTeam}-Schicht` : "Tagschicht",
      })).sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung));
    }
    return fassenZusammen(zeilen, (z) => ({
      schluessel: z.employeeId,
      bezeichnung: z.name,
    })).sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung));
  }, [zeilen, ebene, gesamt]);

  // Monatsverlauf nur sinnvoll, wenn ein ganzes Jahr geladen ist.
  const verlauf = useMemo(() => {
    if (!zeilen || monat !== null) return [];
    const proMonat = fassenZusammen(zeilen, (z) => ({
      schluessel: String(z.monat),
      bezeichnung: MONATSNAMEN[z.monat - 1],
    }));
    return MONATSNAMEN.map((name, i) => {
      const g = proMonat.find((p) => p.schluessel === String(i + 1));
      return {
        label: name,
        rate: g?.gesundheitsrate ?? null,
        sollTage: g?.sollTage ?? 0,
        ausfallTage: g?.ausfallTage ?? 0,
      };
    });
  }, [zeilen, monat]);

  if (mode !== "live") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Führung" title="Auswertung" />
        <Alert tone="info">
          Die Auswertung rechnet mit echten Abwesenheits- und Plandaten und gibt es deshalb nur
          im Live-Modus.
        </Alert>
      </div>
    );
  }

  if (role === "employee") {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Führung" title="Auswertung" />
        <Alert tone="warning">Für diesen Bereich fehlt dir die Berechtigung.</Alert>
      </div>
    );
  }

  const abweichung = gesamt?.gesundheitsrate !== null && gesamt?.gesundheitsrate !== undefined
    ? gesamt.gesundheitsrate - ziel
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Auswertung"
        description="Ausfall, Anwesenheit und Gesundheitsrate – gerechnet aus denselben Daten wie der Schichtplan und die Urlaubskonten."
      />

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <Feld label="Jahr">
            <select
              value={jahr}
              onChange={(e) => setJahr(Number(e.target.value))}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            >
              {[jetzt.getFullYear() - 1, jetzt.getFullYear(), jetzt.getFullYear() + 1].map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Feld>
          <Feld label="Zeitraum">
            <select
              value={monat ?? ""}
              onChange={(e) => setMonat(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">ganzes Jahr</option>
              {MONATSNAMEN.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Feld>
          <Feld label="Ebene">
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {(
                [
                  ["gesamt", "Gesamt"],
                  ["schicht", "Schicht"],
                  ["person", "Mitarbeiter"],
                ] as [Ebene, string][]
              ).map(([wert, text]) => (
                <button
                  key={wert}
                  type="button"
                  onClick={() => setEbene(wert)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                    ebene === wert ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-surface-muted",
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </Feld>
        </CardBody>
      </Card>

      {zeilen === null ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">
              wird gerechnet …
              {monat === null ? " Ein ganzes Jahr dauert ein paar Sekunden." : ""}
            </p>
          </CardBody>
        </Card>
      ) : zeilen.length === 0 ? (
        <Alert tone="info">Für diesen Zeitraum gibt es keine Daten.</Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Gesundheitsrate"
              value={gesamt?.gesundheitsrate?.toFixed(1) ?? "–"}
              unit="%"
              hint={
                abweichung === null
                  ? `Ziel ${ziel} %`
                  : `${abweichung >= 0 ? "+" : ""}${abweichung.toFixed(1)} zum Ziel von ${ziel} %`
              }
              accent={
                abweichung === null ? "neutral" : abweichung >= 0 ? "ok" : abweichung >= -1 ? "warn" : "critical"
              }
              icon={<Activity className="h-4 w-4" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Soll-Arbeitstage"
              value={gesamt?.sollTage ?? 0}
              unit="Tage"
              hint={`${(gesamt?.sollStunden ?? 0).toLocaleString("de-DE")} Stunden`}
              accent="neutral"
              icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Kranktage"
              value={gesamt?.krankTage ?? 0}
              unit="Tage"
              hint={`${(gesamt?.krankTage ?? 0) * 8} Stunden`}
              accent={(gesamt?.krankTage ?? 0) > 0 ? "warn" : "ok"}
              icon={<Thermometer className="h-4 w-4" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Ausfallquote"
              value={gesamt?.ausfallquote?.toFixed(1) ?? "–"}
              unit="%"
              hint={`${gesamt?.ausfallTage ?? 0} Ausfalltage`}
              accent={(gesamt?.ausfallquote ?? 0) > 100 - ziel ? "critical" : "ok"}
              icon={<Thermometer className="h-4 w-4" strokeWidth={1.8} />}
            />
          </div>

          {monat === null && verlauf.length > 0 ? (
            <Card>
              <CardHeader
                title={`Gesundheitsrate im Jahresverlauf ${jahr}`}
                hint={`Abweichung vom Zielwert ${ziel} %. Monate ohne Arbeitstage bleiben leer.`}
              />
              <CardBody>
                <TargetDeviation punkte={verlauf} ziel={ziel} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={
                ebene === "gesamt"
                  ? "Gesamtbetrieb"
                  : ebene === "schicht"
                    ? "Nach Schicht"
                    : "Nach Mitarbeiter"
              }
              hint={
                monat === null ? `Jahr ${jahr}` : `${MONATSNAMEN[monat - 1]} ${jahr}`
              }
            />
            <CardBody className="px-0 sm:px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line">
                      <Kopf links>
                        {ebene === "schicht" ? "Schicht" : ebene === "person" ? "Mitarbeiter" : ""}
                      </Kopf>
                      <Kopf>Soll</Kopf>
                      <Kopf>Anwesend</Kopf>
                      <Kopf>Krank</Kopf>
                      <Kopf>Urlaub</Kopf>
                      <Kopf>V-Tage</Kopf>
                      <Kopf>Sonderurl.</Kopf>
                      <Kopf>Altersfrz.</Kopf>
                      <Kopf>Bildungsurl.</Kopf>
                      <Kopf>Seminar</Kopf>
                      <Kopf>Sonstige</Kopf>
                      <Kopf>Ausfall</Kopf>
                      <Kopf>Quote</Kopf>
                      <Kopf>Gesundheit</Kopf>
                    </tr>
                  </thead>
                  <tbody>
                    {gruppen.map((g) => (
                      <tr key={g.schluessel} className="border-b border-line-soft last:border-0">
                        <td className="px-3 py-2 font-medium sm:px-4">{g.bezeichnung}</td>
                        <Zahl>{g.sollTage}</Zahl>
                        <Zahl>{g.anwesendTage + g.seminarTage}</Zahl>
                        <Zahl betont={g.krankTage > 0}>{g.krankTage}</Zahl>
                        <Zahl>{g.urlaubTage}</Zahl>
                        <Zahl>{g.vTage}</Zahl>
                        <Zahl>{g.sonderurlaubTage}</Zahl>
                        <Zahl>{g.altersfreizeitTage}</Zahl>
                        <Zahl>{g.bildungsurlaubTage}</Zahl>
                        <Zahl>{g.seminarTage}</Zahl>
                        <Zahl>{g.sonstigeTage}</Zahl>
                        <Zahl betont={g.ausfallTage > 0}>{g.ausfallTage}</Zahl>
                        <Zahl>{g.ausfallquote?.toFixed(1) ?? "–"}</Zahl>
                        <td className="px-3 py-2 text-right sm:px-4">
                          {g.gesundheitsrate === null ? (
                            <span className="text-ink-faint">–</span>
                          ) : (
                            <Badge
                              tone={
                                g.gesundheitsrate >= ziel
                                  ? "ok"
                                  : g.gesundheitsrate >= ziel - 1
                                    ? "warn"
                                    : "critical"
                              }
                            >
                              {g.gesundheitsrate.toFixed(1)} %
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <p className="text-center text-[12px] text-ink-faint">
            Gesundheitsrate = Anwesenheit ÷ (Anwesenheit + Ausfall). Seminar zählt als
            Anwesenheit. Urlaub, V-Tage, Sonderurlaub, Altersfreizeit und Bildungsurlaub sind
            geplante Abwesenheiten und gehen in keine der beiden Größen ein.
          </p>
        </>
      )}
    </div>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Kopf({ children, links = false }: { children: React.ReactNode; links?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint sm:px-4",
        links ? "text-left" : "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Zahl({ children, betont = false }: { children: React.ReactNode; betont?: boolean }) {
  return (
    <td
      className={cn(
        "tnum whitespace-nowrap px-3 py-2 text-right sm:px-4",
        betont ? "font-medium text-ink" : "text-ink-muted",
      )}
    >
      {children}
    </td>
  );
}
