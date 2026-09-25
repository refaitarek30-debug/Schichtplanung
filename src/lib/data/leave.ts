import { createClient } from "@/lib/supabase/client";
import { currentIdentity } from "@/lib/supabase/identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type {
  LeaveBalanceViewRow,
  LeaveRequestWithEmployee,
} from "@/lib/supabase/database.types";
import type {
  LeaveKind,
  LiveAfKonto,
  LiveAutoDay,
  LiveTeamBalance,
  LiveTeamSonderKonto,
  LiveVKonto,
  LiveLeaveBalance,
  LiveLeaveKindQuota,
  LiveLeaveKindSuggestion,
  LiveLeaveRequest,
  LiveShiftLeaveEntry,
} from "@/lib/types";

export class DataError extends Error {}

function mapRequest(row: LeaveRequestWithEmployee): LiveLeaveRequest {
  const employee = row.employees;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: employee ? `${employee.first_name} ${employee.last_name}` : undefined,
    shiftName: employee?.shifts?.name ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    halfDayPeriod: row.half_day_period,
    requestedDays: row.requested_days,
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    kind: (row.kind ?? "urlaub") as LiveLeaveRequest["kind"],
    // Klammer um die Zeilen einer Einreichung. NULL heisst: steht allein.
    groupId: row.request_group_id ?? null,
  };
}

const SELECT_WITH_EMPLOYEE =
  "id, company_id, employee_id, start_date, end_date, half_day, half_day_period, requested_days, reason, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at, kind, request_group_id, employees ( first_name, last_name, shift_id, shifts ( name ) )";

/** Eigene Anträge – Reihenfolge neueste zuerst. */
export async function fetchMyLeaveRequests(): Promise<LiveLeaveRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const ich = await currentIdentity();
  if (!ich) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  if (!ich.employeeId) return [];

  const [antraege, pruefer] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(SELECT_WITH_EMPLOYEE)
      .eq("employee_id", ich.employeeId)
      .order("start_date", { ascending: false })
      .returns<LeaveRequestWithEmployee[]>(),
    // Wer entschieden hat. Die Profile der Führung darf ein Mitarbeiter
    // nicht lesen – den Namen liefert deshalb eine eigene Funktion, und nur
    // für die eigenen Anträge.
    supabase.rpc("my_leave_reviewers"),
  ]);

  if (antraege.error) throw new DataError(dataErrorMessage(antraege.error) ?? "Unbekannter Fehler");
  const namen = new Map<string, string>();
  for (const row of (pruefer.data ?? []) as { request_id: string; reviewer_name: string }[]) {
    namen.set(row.request_id, row.reviewer_name);
  }
  return (antraege.data ?? []).map((row) => ({
    ...mapRequest(row),
    reviewerName: namen.get(row.id) ?? null,
  }));
}

/**
 * Anträge zur Entscheidung / Übersicht für Führungskräfte – nur die, über
 * die man auch entscheiden darf.
 */
export async function fetchReviewLeaveRequests(): Promise<LiveLeaveRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const [antraege, erlaubt] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(SELECT_WITH_EMPLOYEE)
      .order("start_date", { ascending: true })
      .returns<LeaveRequestWithEmployee[]>(),
    // Nur, worüber man entscheiden darf: die Schichtleitung sieht die
    // eigene Schicht (ohne die eigenen Anträge), die Administration alles.
    // Die Regel steht in der Datenbank (darf_urlaub_entscheiden).
    supabase.rpc("entscheidbare_mitarbeiter"),
  ]);

  if (antraege.error) throw new DataError(dataErrorMessage(antraege.error) ?? "Unbekannter Fehler");
  if (erlaubt.error) throw new DataError(dataErrorMessage(erlaubt.error) ?? "Unbekannter Fehler");
  const ids = new Set(((erlaubt.data ?? []) as { employee_id: string }[]).map((r) => r.employee_id));
  return (antraege.data ?? []).filter((r) => ids.has(r.employee_id)).map(mapRequest);
}

/** Urlaubskonto des angemeldeten Benutzers für ein Jahr (Standard: laufendes Jahr). */
export async function fetchMyLeaveBalance(
  year = new Date().getFullYear(),
): Promise<LiveLeaveBalance | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const ich = await currentIdentity();
  if (!ich) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  if (!ich.employeeId) return null;

  // Legt das Konto des Jahres an, falls es noch fehlt, und zieht den
  // Übertrag nach, solange das Vorjahr noch läuft. Damit stimmt die Zahl
  // auch dann, wenn jemand im Herbst schon das kommende Jahr plant.
  await supabase.rpc("ensure_leave_balance", {
    p_employee_id: ich.employeeId,
    p_year: year,
  });

  const { data, error } = await supabase
    .from("leave_balances_view")
    .select(
      "year, entitlement, carried_over, used_days, planned_days, pending_days, remaining_days, v_entitlement, v_carried_over, v_used_days, v_pending_days, v_remaining_days",
    )
    .eq("employee_id", ich.employeeId)
    .eq("year", year)
    .returns<LeaveBalanceViewRow[]>()
    .maybeSingle();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  if (!data) return null;

  return {
    year: data.year,
    entitlement: data.entitlement,
    carriedOver: data.carried_over,
    usedDays: data.used_days,
    plannedDays: data.planned_days,
    pendingDays: data.pending_days,
    remainingDays: data.remaining_days,
    vEntitlement: data.v_entitlement ?? 0,
    vCarriedOver: data.v_carried_over ?? 0,
    vUsedDays: data.v_used_days ?? 0,
    vPendingDays: data.v_pending_days ?? 0,
    vRemainingDays: data.v_remaining_days ?? 0,
  };
}

interface SuggestLeaveKindRow {
  kind: string;
  grund: string;
  u_rest: number;
  v_rest: number;
}

/**
 * Empfehlung der Datenbank, ob für einen Tag Urlaub oder ein V-Tag genommen
 * werden sollte (`suggest_leave_kind()`). An Sonn-/Feiertagen und in der
 * Nachtschicht lohnt sich Urlaub, weil die Zuschläge mitbezahlt werden – an
 * normalen Tagen ist der V-Tag günstiger. Nur ein Vorschlag: die Entscheidung
 * trifft weiterhin die antragstellende Person im Formular.
 */
export async function fetchLeaveKindSuggestion(
  employeeId: string,
  dateISO: string,
): Promise<LiveLeaveKindSuggestion | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("suggest_leave_kind", {
    p_employee_id: employeeId,
    p_date: dateISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  const row = ((data ?? []) as SuggestLeaveKindRow[])[0];
  if (!row) return null;
  return {
    kind: row.kind === "urlaub" || row.kind === "v_tag" ? row.kind : "keins",
    reason: row.grund,
    remainingLeave: Number(row.u_rest ?? 0),
    remainingV: Number(row.v_rest ?? 0),
  };
}

/**
 * Wie viele Tage kostet dieser Zeitraum – genau so, wie der Server sie beim
 * Speichern zählt.
 *
 * Früher rechnete das Formular selbst: Montag bis Freitag ohne Feiertage.
 * Im Schichtbetrieb stimmt das nicht. Wer am Wochenende oder am Feiertag
 * Schicht hat, bekam „0 Tage" angezeigt und konnte Urlaub von Hand gar
 * nicht erst absenden – der Server hätte dieselben Tage aber korrekt
 * gezählt (nachgemessen: 01.–03.01.2027 mit drei Nachtschichten, Vorschau
 * 0, Server 3). Jetzt fragt das Formular dieselbe Funktion, die auch der
 * Trigger beim Speichern benutzt.
 */
export async function fetchLeaveDayCount(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("calculate_leave_days_for_employee", {
    p_employee_id: employeeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_half_day_period: null,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return Number(data ?? 0);
}

/**
 * Überschneidung mit Kolleginnen/Kollegen und Mindestbesetzung – ersetzt
 * durch `fetchLeaveImpact()` in `src/lib/data/staffing.ts`, das seit
 * Phase 4 auch den kritischen Status zurückgibt, nicht nur die Anzahl.
 */

interface ShiftLeaveRow {
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_me: boolean;
  reason_visible: boolean;
  kind: string | null;
}

/**
 * Wer aus der eigenen Schicht (feste Zuordnung oder gleiches Rotationsmuster)
 * fehlt im angegebenen Zeitraum – mit Namen.
 *
 * Absichtlich nur Urlaub (`leave_requests`), keine Krankmeldungen: der Grund
 * einer krankheitsbedingten Abwesenheit bleibt Sache der Führung.
 *
 * Ob der Grund „Urlaub“ überhaupt genannt werden darf, entscheidet die
 * betroffene Person über ihre Datenschutzeinstellung. Die Datenbank liefert
 * das Ergebnis dieser Entscheidung in `reason_visible` mit und lässt ohne
 * Freigabe noch nicht genehmigte Anträge ganz weg.
 */
export async function fetchMyShiftLeave(
  fromISO: string,
  toISO: string,
): Promise<LiveShiftLeaveEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_shift_leave", {
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as ShiftLeaveRow[]).map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as LiveShiftLeaveEntry["status"],
    isMe: row.is_me,
    // Die Datenbank entscheidet, nicht der Browser. Fehlt das Feld (alter
    // Server), gilt die restriktive Annahme.
    reasonVisible: row.reason_visible === true,
    // Die Art liefert der Server nur bei freigegebenem Grund.
    kind: (row.kind ?? null) as LiveShiftLeaveEntry["kind"],
  }));
}

interface AutoPreviewRow {
  tag: string;
  art: string;
  grund: string;
}

/**
 * Vorschau: welcher Tag im Zeitraum würde auf welches Konto gehen?
 * Rechnet dieselbe Logik wie `submit_leave_auto()`, schreibt aber nichts.
 */
export async function fetchAutoPreview(
  startISO: string,
  endISO: string,
): Promise<LiveAutoDay[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("preview_leave_auto", {
    p_start_date: startISO,
    p_end_date: endISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as AutoPreviewRow[]).map((row) => ({
    date: row.tag,
    kind: row.art === "urlaub" ? "urlaub" : row.art === "v_tag" ? "v_tag" : "keins",
    reason: row.grund,
  }));
}

interface TeamBalanceRow {
  employee_id: string;
  rest: number;
  anspruch: number;
  v_rest: number;
  v_anspruch: number;
}

/** Rest-Urlaub und Rest-V-Tage je Mitarbeiter, Schlüssel ist die Mitarbeiter-ID. */
export async function fetchTeamBalances(
  year?: number,
): Promise<Map<string, LiveTeamBalance>> {
  if (!isSupabaseConfigured) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_leave_balances", {
    p_year: year ?? null,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  const map = new Map<string, LiveTeamBalance>();
  for (const row of (data ?? []) as TeamBalanceRow[]) {
    map.set(row.employee_id, {
      remainingDays: Number(row.rest ?? 0),
      entitlement: Number(row.anspruch ?? 0),
      vRemainingDays: Number(row.v_rest ?? 0),
      vEntitlement: Number(row.v_anspruch ?? 0),
    });
  }
  return map;
}


interface QuotaRow {
  kind: string;
  anspruch: number;
  verbraucht: number;
  rest: number;
  erlaubt: boolean;
}

/**
 * Die eigenen Jahreskontingente für Altersfreizeit, Sonderurlaub,
 * Bildungsurlaub und Gewerkschaftstag.
 *
 * Urlaub und V-Tage stehen nicht darin – die haben ihr eigenes Konto.
 */
export async function fetchMyLeaveKindQuotas(jahr: number): Promise<LiveLeaveKindQuota[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_leave_kind_quotas", { p_year: jahr });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as QuotaRow[]).map((row) => ({
    kind: row.kind as LiveLeaveKindQuota["kind"],
    anspruch: Number(row.anspruch),
    verbraucht: Number(row.verbraucht),
    rest: Number(row.rest),
    erlaubt: row.erlaubt === true,
  }));
}

interface AfKontoRow {
  freigeschaltet_ab: string | null;
  start_stunden: number;
  arbeitstage: number;
  stunden_angespart: number;
  genommen: number;
  beantragt: number;
  verplant: number;
  stand_stunden: number;
  verfuegbar: number;
  rest_stunden: number;
}

/** Das eigene Altersfreizeit-Konto (Stunden und Tage). */
export async function fetchMyAfKonto(): Promise<LiveAfKonto | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_af_konto");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = ((data ?? []) as AfKontoRow[])[0];
  if (!row) return null;
  return {
    freigeschaltetAb: row.freigeschaltet_ab,
    startStunden: Number(row.start_stunden ?? 0),
    arbeitstage: Number(row.arbeitstage ?? 0),
    stundenAngespart: Number(row.stunden_angespart ?? 0),
    genommen: Number(row.genommen ?? 0),
    beantragt: Number(row.beantragt ?? 0),
    verplant: Number(row.verplant ?? 0),
    standStunden: Number(row.stand_stunden ?? 0),
    verfuegbar: Number(row.verfuegbar ?? 0),
    restStunden: Number(row.rest_stunden ?? 0),
  };
}

interface TeamSonderRow {
  employee_id: string;
  su_erlaubt: boolean;
  su_anspruch: number;
  su_rest: number;
  af_freigeschaltet: boolean;
  af_verfuegbar: number;
  af_rest_stunden: number;
  af_stand: number;
  v_stunden: boolean;
  v_stand: number;
  v_moeglich: number;
}

/** Sonderurlaub und Altersfreizeit je Mitarbeiter (nur Führung). */
export async function fetchTeamSonderKonten(): Promise<Map<string, LiveTeamSonderKonto>> {
  if (!isSupabaseConfigured) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_sonder_konten", { p_year: null });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const map = new Map<string, LiveTeamSonderKonto>();
  for (const row of (data ?? []) as TeamSonderRow[]) {
    map.set(row.employee_id, {
      suErlaubt: row.su_erlaubt === true,
      suAnspruch: Number(row.su_anspruch ?? 0),
      suRest: Number(row.su_rest ?? 0),
      afFreigeschaltet: row.af_freigeschaltet === true,
      afVerfuegbar: Number(row.af_verfuegbar ?? 0),
      afRestStunden: Number(row.af_rest_stunden ?? 0),
      afStand: Number(row.af_stand ?? 0),
      vStunden: row.v_stunden === true,
      vStand: Number(row.v_stand ?? 0),
      vMoeglich: Number(row.v_moeglich ?? 0),
    });
  }
  return map;
}

/**
 * Offene Anträge für die Sammelgenehmigung, ältester Antrag zuerst –
 * optional nur die eines Jahres (Beginn oder Ende im Jahr).
 */
export async function fetchSammelKandidaten(jahr: number | null): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sammelgenehmigung_kandidaten", { p_jahr: jahr });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as { antrag_id: string }[]).map((r) => r.antrag_id);
}

/**
 * Einen Antrag prüfen und, wenn nichts reisst, genehmigen. Die Prüfung
 * (Besetzung, Qualifikationen, Konto) liegt vollständig in der Datenbank.
 */
export async function sicherGenehmigen(
  antragId: string,
): Promise<{ genehmigt: boolean; grund: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sicher_genehmigen", { p_request_id: antragId });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const zeile = ((data ?? []) as { ergebnis: string; grund: string | null }[])[0];
  return { genehmigt: zeile?.ergebnis === "genehmigt", grund: zeile?.grund ?? null };
}

export interface LiveNaechsterUrlaub {
  von: string;
  bis: string;
  /** Urlaubs-, V- und sonstige Tage, die es kostet. */
  tage: number;
  /** Frei am Stück, vom ersten bis zum letzten Tag. */
  kalendertage: number;
  arten: LeaveKind[];
  offen: boolean;
}

/**
 * Der nächste eigene Urlaub am Stück: Anträge, zwischen denen nur freie
 * Tage laut Plan liegen, zählen als ein Urlaub.
 */
export async function fetchNaechsterUrlaub(): Promise<LiveNaechsterUrlaub | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mein_naechster_urlaub");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = ((data ?? []) as {
    von: string;
    bis: string;
    tage: number;
    kalendertage: number;
    arten: string[];
    offen: boolean;
  }[])[0];
  if (!row) return null;
  return {
    von: row.von,
    bis: row.bis,
    tage: Number(row.tage ?? 0),
    kalendertage: Number(row.kalendertage ?? 0),
    arten: (row.arten ?? []) as LeaveKind[],
    offen: row.offen === true,
  };
}

/** Das eigene V-Stundenkonto; null, wenn V in Tagen geführt wird. */
export async function fetchMyVKonto(): Promise<LiveVKonto | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_v_konto");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row || !row.stichtag) return null;
  const z = (v: unknown) => Number(v ?? 0);
  return {
    stichtag: String(row.stichtag),
    startStunden: z(row.start_stunden),
    arbeitstage: z(row.arbeitstage),
    angespart: z(row.angespart),
    genommen: z(row.genommen),
    verplant: z(row.verplant),
    standHeute: z(row.stand_heute),
    nochMoeglich: z(row.noch_moeglich),
    restStunden: z(row.rest_stunden),
  };
}
