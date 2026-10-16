import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Versand der Erinnerungen (Termine, To-dos) als Mitteilung. Wird jede
 * Minute aus der Datenbank angestoßen (pg_cron → erinnerungen_anstossen,
 * Migration 0155) – aber nur, wenn etwas fällig ist. Ohne das Geheimnis im
 * Kopf passiert nichts.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Faellig {
  user_id: string;
  art: "termin" | "todo";
  ref_id: string;
  titel: string;
  datum: string;
  beginn: string | null;
  ganztaegig: boolean;
  faellig_am: string;
}

interface Abo {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function gleich(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** „Heute 14:00“, „Morgen ganztägig“, „Fr, 13.11. 9:30“ – in deutscher Zeit. */
function wann(f: Faellig): string {
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const morgen = new Date(`${heute}T12:00:00Z`);
  morgen.setUTCDate(morgen.getUTCDate() + 1);
  const d = new Date(`${f.datum}T12:00:00Z`);
  const tag =
    f.datum === heute
      ? "Heute"
      : f.datum === morgen.toISOString().slice(0, 10)
        ? "Morgen"
        : `${WT[d.getUTCDay()]}, ${f.datum.slice(8, 10)}.${f.datum.slice(5, 7)}.`;
  if (f.art === "todo") return f.beginn ? `To-do · ${tag} ${f.beginn}` : `To-do · ${tag}`;
  return f.ganztaegig || !f.beginn ? `${tag} · ganztägig` : `${tag} um ${f.beginn}`;
}

export async function POST(anfrage: Request) {
  const geheimnis = process.env.ERINNERUNG_GEHEIMNIS;
  const privat = process.env.VAPID_PRIVATE_KEY;
  const oeffentlich = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const kopf = anfrage.headers.get("x-erinnerung") ?? "";
  if (!geheimnis || !gleich(kopf, geheimnis)) return new NextResponse(null, { status: 404 });
  if (!privat || !oeffentlich) return NextResponse.json({ fehler: "nicht eingerichtet" }, { status: 503 });

  webpush.setVapidDetails("https://ready-flame.vercel.app", oeffentlich, privat);
  const db = createAdminClient();

  const { data: faellig, error } = await db.rpc("faellige_erinnerungen");
  if (error) return NextResponse.json({ fehler: "datenbank" }, { status: 500 });
  const liste = (faellig ?? []) as Faellig[];
  if (!liste.length) return NextResponse.json({ gesendet: 0 });

  const { data: abos } = await db.rpc("push_abos_fuer", { p_users: [...new Set(liste.map((f) => f.user_id))] });
  const nachPerson = new Map<string, Abo[]>();
  for (const a of (abos ?? []) as Abo[]) nachPerson.set(a.user_id, [...(nachPerson.get(a.user_id) ?? []), a]);

  let gesendet = 0;
  const ungueltig = new Set<string>();
  await Promise.allSettled(
    liste.flatMap((f) =>
      (nachPerson.get(f.user_id) ?? []).map(async (a) => {
        const inhalt = JSON.stringify({
          titel: `${f.art === "todo" ? "✅" : "🔔"} ${f.titel || (f.art === "todo" ? "To-do" : "Termin")}`,
          text: wann(f),
          tag: `${f.art}-${f.ref_id}`,
          url: "/start",
        });
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, inhalt, {
            TTL: 60 * 60,
            urgency: "high",
          });
          gesendet++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // Gerät abgemeldet oder Adresse abgelaufen: vergessen.
          if (code === 404 || code === 410) ungueltig.add(a.endpoint);
        }
      }),
    ),
  );
  await Promise.allSettled([...ungueltig].map((endpoint) => db.rpc("push_abo_ungueltig", { p_endpoint: endpoint })));

  return NextResponse.json({ gesendet, entfernt: ungueltig.size });
}
