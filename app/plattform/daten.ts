import type { Konsole } from "@/lib/auth/konsole";
import type { Dashboard, FirmaKennzahlen, Umfrage } from "./tabelle";

/** Firmenliste aus platform_overview – nur Kennzahlen. */
export async function ladeFirmen(k: Konsole): Promise<FirmaKennzahlen[]> {
  const { data, error } = await k.admin.rpc("platform_overview");
  if (error) throw new Error(`Die Firmenliste konnte nicht geladen werden: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    companyId: String(row.company_id),
    name: String(row.name ?? ""),
    angelegtAm: (row.angelegt_am as string | null) ?? null,
    aktiv: Boolean(row.aktiv),
    avvAkzeptiertAm: (row.avv_akzeptiert_am as string | null) ?? null,
    einrichtungFertigAm: (row.einrichtung_fertig_am as string | null) ?? null,
    mitarbeiterAktiv: Number(row.mitarbeiter_aktiv ?? 0),
    zugaenge: Number(row.zugaenge ?? 0),
    letzteAktivitaet: (row.letzte_aktivitaet as string | null) ?? null,
    urlaubsantraege: Number(row.urlaubsantraege ?? 0),
    offeneAntraege: Number(row.offene_antraege ?? 0),
  }));
}

/** Dashboard und Umfrage sind Zugaben: schlagen sie fehl, bleibt die Seite stehen. */
export async function ladeDashboard(k: Konsole): Promise<Dashboard | null> {
  const { data } = await k.admin.rpc("platform_dashboard", { p_limit: 30 });
  return (data as Dashboard | null) ?? null;
}

export async function ladeUmfrage(k: Konsole): Promise<Umfrage | null> {
  const { data } = await k.admin.rpc("platform_umfrage");
  return (data as Umfrage | null) ?? null;
}
