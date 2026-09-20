import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import type { FormState } from "./form-state";

/*
 * Zugang einrichten – die eine Stelle, an der Einladungen entstehen.
 *
 * Bewusst KEIN "use server": Diese Datei wird nur von Server-Aktionen
 * benutzt, die vorher die Berechtigung prüfen. Wäre `grantAccess` selbst
 * eine Server-Aktion, könnte sie jeder aus dem Browser mit beliebigen
 * Angaben aufrufen und sich so einen Zugang zu einer fremden Firma
 * erzeugen.
 */

/**
 * Öffentliche Adresse dieser Installation. Einladungslinks müssen darauf
 * zeigen – nicht auf localhost und nicht auf eine Vorschau-Adresse.
 *
 * Warum die Adresse in der Produktion NICHT aus dem Anfrage-Header kommt:
 * `Host` und `X-Forwarded-Host` bestimmt der Aufrufende. Wer sie fälscht,
 * bekäme einen Einladungslink, der auf seine eigene Seite zeigt – und damit
 * das Token einer fremden Person. Die Adresse muss deshalb von der
 * Serverseite stammen.
 *
 * Reihenfolge:
 *
 *   1. NEXT_PUBLIC_SITE_URL – die ausdrücklich gesetzte eigene Domain.
 *   2. VERCEL_PROJECT_PRODUCTION_URL – setzt Vercel selbst, immer die
 *      Produktionsadresse, auch aus einer Vorschau heraus. Nicht vom
 *      Aufrufenden beeinflussbar, die Absicherung bleibt also bestehen.
 *   3. Außerhalb der Produktion der Anfrage-Header, damit die Entwicklung
 *      ohne Konfiguration läuft.
 *
 * Punkt 2 war der Fehler: die Sperre verlangte eine Variable, die auf
 * Vercel nie angelegt wurde. Jede Einladung endete deshalb in der
 * Produktion mit einem Serverfehler, statt den Link zu erzeugen.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL muss in der Produktion HTTPS verwenden.");
    }
    return url.origin;
  }

  // Vercel liefert die Adresse ohne Schema.
  const vercelProduktion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduktion) {
    return new URL(`https://${vercelProduktion}`).origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Keine öffentliche Adresse hinterlegt. Bitte NEXT_PUBLIC_SITE_URL setzen.",
    );
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Keine öffentliche Host-Adresse verfügbar.");
  return `${protocol}://${host}`;
}

/** Ziel nach dem Einlösen eines Einladungs- oder Passwortlinks. */
const NACH_EINLADUNG = "/passwort-neu";

/**
 * Einen Link bauen, der ohne Umweg über Supabase funktioniert.
 *
 * `generateLink` liefert neben dem fertigen `action_link` auch den rohen
 * `hashed_token`. Der fertige Link führt zuerst zu Supabase und von dort mit
 * den Angaben hinter dem Rautezeichen zurück – ein Weg, der schon an einer
 * abweichenden Site-URL scheitert. Mit dem rohen Token zeigt der Link direkt
 * auf die eigene Anwendung, die ihn serverseitig einlöst. Das ist der
 * verlässlichere Weg und der Grund, warum eine Einladung jetzt auch ohne
 * Postversand ankommt.
 */
function buildInviteUrl(
  origin: string,
  properties: { hashed_token?: string | null; action_link?: string | null },
  type: "invite" | "recovery",
): string | null {
  if (properties.hashed_token) {
    const url = new URL(`${origin}/auth/callback`);
    url.searchParams.set("token_hash", properties.hashed_token);
    url.searchParams.set("type", type);
    url.searchParams.set("weiter", NACH_EINLADUNG);
    return url.toString();
  }
  return properties.action_link ?? null;
}

/**
 * Einladungslink erzeugen, ohne eine Mail zu verschicken.
 *
 * Für ein noch nicht angelegtes Konto ist das ein Einladungslink – dabei
 * entsteht das Konto gleich mit. Für ein bestehendes Konto ein Link zum
 * Passwort-Neusetzen. Beide führen an dieselbe Stelle.
 */
async function createInviteLink(
  email: string,
  origin: string,
  redirectTo: string,
  metadata: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const einladung = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: metadata },
  });
  if (!einladung.error && einladung.data?.properties) {
    const link = buildInviteUrl(origin, einladung.data.properties, "invite");
    if (link) return link;
  }

  const zuruecksetzen = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (!zuruecksetzen.error && zuruecksetzen.data?.properties) {
    return buildInviteUrl(origin, zuruecksetzen.data.properties, "recovery");
  }

  return null;
}

/**
 * Fehler der Verwaltungs-Schnittstelle in Klartext übersetzen. Die Ursachen
 * unterscheiden sich grundlegend – Schlüssel falsch, Postversand nicht
 * eingerichtet, Adresse schon vergeben – und jede braucht eine andere
 * Reaktion. Ein gemeinsames "hat nicht geklappt" hilft niemandem.
 */
function inviteErrorMessage(
  error: { message?: string; status?: number; code?: string },
  email: string,
): string {
  const message = (error.message ?? "").toLowerCase();
  const status = error.status ?? 0;

  if (status === 401 || status === 403 || message.includes("invalid api key")) {
    return "Der Server-Schlüssel für Einladungen (SUPABASE_SERVICE_ROLE_KEY) wird von Supabase abgelehnt. Vermutlich ist er veraltet oder gehört zu einem anderen Projekt – in Vercel neu hinterlegen und erneut bereitstellen.";
  }
  if (message.includes("already been registered") || message.includes("already exists")) {
    return `Für ${email} gibt es bereits einen Zugang. Diese Person kann sich anmelden oder das Passwort über "Passwort vergessen" neu setzen.`;
  }
  if (status === 429 || message.includes("rate limit")) {
    return "Supabase hat den Versand vorerst gesperrt: Ohne eigenen Postausgang sind nur wenige Mails pro Stunde erlaubt. Unter Authentication → Emails einen eigenen SMTP-Versand hinterlegen, dann fällt das Limit weg.";
  }
  if (message.includes("smtp") || message.includes("sending") || message.includes("mail")) {
    return "Die Einladung konnte nicht verschickt werden – der Postversand in Supabase meldet einen Fehler. Unter Authentication → Emails prüfen.";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return `Die Adresse ${email} wird von Supabase nicht akzeptiert. Bitte die Schreibweise prüfen.`;
  }
  return `Die Einladung an ${email} ist fehlgeschlagen: ${error.message ?? "unbekannter Fehler"}`;
}

/**
 * Zugang einrichten: Konto anlegen, Mail versuchen, Link erzeugen.
 *
 * Der eingebaute Postversand von Supabase ist ausdrücklich nur zum
 * Ausprobieren gedacht – wenige Mails pro Stunde, und je nach Projekt gehen
 * sie ausschließlich an Adressen des Projektteams. Genau das ist hier
 * passiert: an Kollegen kam nichts an. Deshalb hängt das Einrichten eines
 * Zugangs nicht mehr am Postversand. Es wird immer ein Link erzeugt, den die
 * Administration selbst weitergeben kann – über den eigenen Mailverteiler,
 * per Nachricht oder ausgedruckt.
 */
export async function grantAccess(
  employee: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    company_id: string;
  },
  origin: string,
): Promise<FormState> {
  if (!employee.email) {
    return { error: "Für diesen Mitarbeiter ist keine E-Mail-Adresse hinterlegt." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Einladungen sind noch nicht eingerichtet: Auf dem Server fehlt der Schlüssel SUPABASE_SERVICE_ROLE_KEY. Er wird in Vercel unter Settings → Environment Variables hinterlegt, danach einmal neu bereitstellen.",
    };
  }

  const redirectTo = `${origin}/auth/callback?weiter=${NACH_EINLADUNG}`;
  const metadata = {
    employee_id: employee.id,
    first_name: employee.first_name,
    last_name: employee.last_name,
  };

  // Erst der Versuch über den Postversand – wenn er läuft, ist das der
  // bequemste Weg für die eingeladene Person.
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(employee.email, {
    redirectTo,
    data: metadata,
  });

  // Unabhängig davon einen Link erzeugen. Kommt die Mail an, ist der Link
  // nur die Rückversicherung; kommt sie nicht an, ist er der eigentliche Weg.
  const link = await createInviteLink(
    employee.email,
    origin,
    redirectTo,
    metadata,
    admin,
  );

  revalidatePath("/verwaltung");

  if (!mailError) {
    return {
      success: `Einladung an ${employee.email} verschickt.`,
      link: link ?? undefined,
    };
  }

  if (link) {
    return {
      success: `Zugang für ${employee.email} eingerichtet. Die Mail konnte nicht verschickt werden – stattdessen diesen Link weitergeben. Er gilt 24 Stunden und ist nur für diese Person.`,
      link,
    };
  }

  return { error: inviteErrorMessage(mailError, employee.email) };
}

