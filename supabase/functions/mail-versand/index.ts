/**
 * Raeumt den Postausgang ab (Tabelle `email_outbox`).
 *
 * Warum eine eigene Funktion und nicht Supabase Auth: der Mailversand von
 * Supabase Auth verschickt ausschliesslich Auth-Mails (Bestaetigung,
 * Einladung, Passwort). Fachliche Nachrichten -- "neuer Urlaubsantrag" --
 * muss die Anwendung selbst zustellen.
 *
 * Ohne SMTP-Zugangsdaten tut die Funktion bewusst nichts und sagt das im
 * Ergebnis. Die Zeilen bleiben dann offen stehen; die Einstellungsseite
 * zeigt den Stau an. Das ist besser, als Mails lautlos zu verwerfen.
 *
 * Erwartete Secrets (Supabase → Edge Functions → Secrets):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzt Supabase selbst.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

/** Hoechstens so viele Mails je Aufruf -- haelt die Laufzeit kurz. */
const STAPEL = 25;
/** Danach gilt eine Zeile als endgueltig gescheitert. */
const MAX_VERSUCHE = 5;

interface OutboxZeile {
  id: string;
  empfaenger: string;
  betreff: string;
  text_teil: string;
  html_teil: string;
  versuche: number;
}

function smtpKonfiguration() {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");

  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("email_outbox")
    .select("id, empfaenger, betreff, text_teil, html_teil, versuche")
    .eq("status", "offen")
    .lt("versuche", MAX_VERSUCHE)
    .order("created_at", { ascending: true })
    .limit(STAPEL);

  if (error) {
    return antwort({ fehler: `Postausgang nicht lesbar: ${error.message}` }, 500);
  }

  const zeilen = (data ?? []) as OutboxZeile[];
  if (zeilen.length === 0) {
    return antwort({ offen: 0, gesendet: 0, hinweis: "Nichts zu versenden." });
  }

  const konfig = smtpKonfiguration();
  if (!konfig) {
    // Kein Abbruch mit Fehler: das ist keine Stoerung, sondern ein noch
    // nicht erledigter Einrichtungsschritt. Die Zeilen bleiben offen.
    return antwort({
      offen: zeilen.length,
      gesendet: 0,
      hinweis:
        "SMTP ist nicht eingerichtet (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). " +
        "Die Nachrichten bleiben im Postausgang stehen und gehen nicht verloren.",
    });
  }

  const client = new SMTPClient({
    connection: {
      hostname: konfig.host,
      port: konfig.port,
      tls: konfig.port === 465,
      auth: { username: konfig.user, password: konfig.pass },
    },
  });

  let gesendet = 0;
  let gescheitert = 0;

  for (const zeile of zeilen) {
    try {
      await client.send({
        from: konfig.from,
        to: zeile.empfaenger,
        subject: zeile.betreff,
        content: zeile.text_teil,
        html: zeile.html_teil,
      });

      await supabase
        .from("email_outbox")
        .update({
          status: "gesendet",
          gesendet_at: new Date().toISOString(),
          versuche: zeile.versuche + 1,
          letzter_fehler: null,
        })
        .eq("id", zeile.id);
      gesendet++;
    } catch (caught) {
      const grund = caught instanceof Error ? caught.message : String(caught);
      // Erst nach MAX_VERSUCHE endgueltig aufgeben -- ein kurzer Ausfall
      // des Mailservers soll keine Nachricht kosten.
      const endgueltig = zeile.versuche + 1 >= MAX_VERSUCHE;
      await supabase
        .from("email_outbox")
        .update({
          status: endgueltig ? "fehler" : "offen",
          versuche: zeile.versuche + 1,
          letzter_fehler: grund.slice(0, 500),
        })
        .eq("id", zeile.id);
      gescheitert++;
    }
  }

  try {
    await client.close();
  } catch {
    // Beim Schliessen schiefgegangen ist fuer das Ergebnis unerheblich.
  }

  return antwort({ offen: zeilen.length, gesendet, gescheitert });
});

function antwort(inhalt: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(inhalt), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
