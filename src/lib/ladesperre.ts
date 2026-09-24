/**
 * Ladesperre: solange etwas gespeichert wird, keine zweiten Klicks.
 *
 * Gezählt werden nur schreibende Anfragen – Serveraktionen und die
 * Supabase-Aufrufe, die etwas ändern. Das Nachladen im Hintergrund
 * (Änderungsstempel, Plan auffrischen) sperrt nichts; sonst stünde bei
 * langsamer Verbindung ständig ein Schleier über der Seite.
 *
 * Warum überhaupt: auf dem Handy mit schlechtem Netz tippt man gern zweimal
 * oder springt weiter, bevor die erste Aktion durch ist. Eine doppelt
 * abgeschickte Genehmigung oder ein halb gespeicherter Plan sind die Folge.
 */

type Hoerer = (laufend: number) => void;

let laufend = 0;
const hoerer = new Set<Hoerer>();

function melden() {
  for (const h of hoerer) h(laufend);
}

export function beobachteLadesperre(h: Hoerer): () => void {
  hoerer.add(h);
  h(laufend);
  return () => {
    hoerer.delete(h);
  };
}

/** Schreibende Datenbankfunktionen – nur die sperren. */
const SCHREIBENDE_RPC =
  /\/rpc\/(set_|decide_|submit_|withdraw_|sicher_genehmigen|approve_|create_|confirm_|plan_set|save_|delete_|update_|assign|register_|ensure_holidays|discard_)/;

export function istSchreibend(url: string, methode: string, kopf?: HeadersInit): boolean {
  const m = methode.toUpperCase();
  // Next.js-Serveraktion
  if (kopf) {
    const h = new Headers(kopf);
    if (h.has("Next-Action")) return true;
  }
  if (!url.includes("/rest/v1/")) return false;
  if (url.includes("/rpc/")) return SCHREIBENDE_RPC.test(url);
  return m === "POST" || m === "PATCH" || m === "PUT" || m === "DELETE";
}

/** fetch, das schreibende Anfragen mitzählt. */
export async function gezaehlterFetch(
  eingabe: RequestInfo | URL,
  init?: RequestInit,
  darunter: typeof fetch = fetch,
): Promise<Response> {
  const url =
    typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url;
  const methode = init?.method ?? (eingabe instanceof Request ? eingabe.method : "GET");
  const kopf = init?.headers ?? (eingabe instanceof Request ? eingabe.headers : undefined);
  const zaehlen = typeof window !== "undefined" && istSchreibend(url, methode, kopf);
  if (zaehlen) {
    laufend += 1;
    melden();
  }
  try {
    return await darunter(eingabe, init);
  } finally {
    if (zaehlen) {
      laufend = Math.max(0, laufend - 1);
      melden();
    }
  }
}

let umgebaut = false;

/**
 * window.fetch einmal je Tab umbauen, damit schreibende Anfragen gezählt
 * werden. Muss vor dem Anlegen des Supabase-Clients laufen – der merkt sich
 * fetch beim Erzeugen.
 */
export function installiereLadesperre(): void {
  if (umgebaut || typeof window === "undefined") return;
  const original = window.fetch.bind(window);
  window.fetch = ((eingabe: RequestInfo | URL, init?: RequestInit) =>
    gezaehlterFetch(eingabe, init, original)) as typeof window.fetch;
  umgebaut = true;
}
