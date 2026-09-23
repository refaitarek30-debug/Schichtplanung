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
 * Das Konto, das bereits zu diesem Mitarbeiter gehört – oder null.
 *
 * Maßgeblich ist die Verknüpfung im Profil, nicht die E-Mail-Adresse im
 * Personalstamm: die Adresse trägt die Administration von Hand ein, sie
 * beweist nicht, wem ein Konto gehört.
 */
async function verknuepftesKonto(
  employeeId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ id: string; email: string | null } | "fehler" | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("employee_id", employeeId)
    .maybeSingle<{ id: string }>();
  if (error) return "fehler";
  if (!data) return null;

  const { data: konto, error: kontoFehler } = await admin.auth.admin.getUserById(data.id);
  if (kontoFehler || !konto?.user) return "fehler";
  return { id: konto.user.id, email: konto.user.email ?? null };
}

/**
 * Einladungslink erzeugen, ohne eine Mail zu verschicken.
 *
 * Für ein noch nicht angelegtes Konto ist das ein Einladungslink – dabei
 * entsteht das Konto gleich mit. Für das bestehende Konto DIESES
 * Mitarbeiters ein Link zum Passwort-Neusetzen. Beide führen an dieselbe
 * Stelle.
 *
 * Früher gab es bei jeder schon vergebenen Adresse einen Passwort-Link –
 * egal, wem das Konto gehörte. Wer einen Mitarbeiter mit der Adresse einer
 * fremden Person anlegte (auch in einer eigens registrierten Firma), bekam
 * so einen Anmeldelink für deren Konto. Deshalb gibt es den Passwort-Link
 * nur noch für das Konto, das nachweislich mit diesem Mitarbeiter
 * verknüpft ist.
 */
async function createInviteLink(
  employeeId: string,
  email: string,
  origin: string,
  redirectTo: string,
  metadata: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ link: string } | { fehler: string }> {
  const konto = await verknuepftesKonto(employeeId, admin);
  if (konto === "fehler") {
    return { fehler: "Der bestehende Zugang ließ sich nicht prüfen. Bitte später erneut versuchen." };
  }

  if (konto) {
    // Der Link gilt immer dem Konto, mit dem sich die Person anmeldet. Steht
    // im Personalstamm inzwischen eine andere Adresse, würde ein Link dafür
    // ein fremdes oder gar kein Konto treffen.
    if (!konto.email || konto.email.toLowerCase() !== email.toLowerCase()) {
      return {
        fehler:
          "Für diesen Mitarbeiter gibt es bereits einen Zugang unter einer anderen E-Mail-Adresse. " +
          "Die Anmeldeadresse lässt sich hier nicht ändern.",
      };
    }
    const zuruecksetzen = await admin.auth.admin.generateLink({
      type: "recovery",
      email: konto.email,
      options: { redirectTo },
    });
    const link =
      !zuruecksetzen.error && zuruecksetzen.data?.properties
        ? buildInviteUrl(origin, zuruecksetzen.data.properties, "recovery")
        : null;
    return link ? { link } : { fehler: "Es ließ sich kein neuer Zugangslink erzeugen." };
  }

  const einladung = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo, data: metadata },
  });
  if (!einladung.error && einladung.data?.properties) {
    const link = buildInviteUrl(origin, einladung.data.properties, "invite");
    if (link) return { link };
  }

  // Die Adresse gehört schon zu einem Konto, aber nicht zu diesem
  // Mitarbeiter. Kein Passwort-Link – siehe oben.
  return {
    fehler:
      `Für ${email} liess sich kein Zugangslink erzeugen. Entweder gehört die Adresse bereits ` +
      `zu einem anderen Konto, oder sie ist falsch geschrieben.`,
  };
}

/**
 * Zugang einrichten: Konto anlegen und Link erzeugen.
 *
 * Es wird IMMER ein Link zurückgegeben und KEINE Mail verschickt. Der
 * eingebaute Postversand von Supabase ist ausdrücklich nur zum Ausprobieren
 * gedacht – wenige Mails pro Stunde, und je nach Projekt gehen sie
 * ausschließlich an Adressen des Projektteams. An Kollegen kam nichts an.
 *
 * Der Link wird angezeigt und von Hand weitergegeben, über WhatsApp, den
 * eigenen Verteiler oder ausgedruckt. Das ist kein Notbehelf, sondern der
 * verlässlichere Weg: die Administration sieht sofort, dass der Zugang
 * bereitsteht, statt auf eine Mail zu hoffen, die vielleicht nie ankommt.
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

  // Es wird KEINE Mail mehr verschickt. Zwei Gründe, beide aus der Praxis:
  //
  //  1. Der eingebaute Postversand von Supabase ist ausdrücklich zum
  //     Ausprobieren gedacht – wenige Mails pro Stunde, und je nach Projekt
  //     gehen sie ausschliesslich an Adressen des Projektteams. An Kollegen
  //     kam nichts an.
  //  2. Supabase hinterlegt je Person und Art nur EIN gültiges Einmal-Token.
  //     Eine Mail zu verschicken und danach einen Link zu erzeugen machte
  //     genau das Token unbrauchbar, das gerade unterwegs war – die Mail
  //     führte dann auf „bereits eingelöst“, ohne je benutzt worden zu sein.
  //
  // Ein Weg, ein Token, kein Rennen. Der Link wird angezeigt und von Hand
  // weitergegeben – über WhatsApp, den eigenen Verteiler oder ausgedruckt.
  const ergebnis = await createInviteLink(
    employee.id,
    employee.email,
    origin,
    redirectTo,
    metadata,
    admin,
  );

  revalidatePath("/verwaltung");

  if ("link" in ergebnis) {
    return {
      success: `Zugang für ${employee.email} eingerichtet. Diesen Link weitergeben – er gilt 24 Stunden und ist nur für diese Person.`,
      link: ergebnis.link,
    };
  }

  return { error: ergebnis.fehler };
}

