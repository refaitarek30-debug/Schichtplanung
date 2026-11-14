"use server";

import { revalidatePath } from "next/cache";
import { betreiberPruefen, betreiberProtokoll } from "@/lib/auth/betreiber";
import { buildInviteUrl, siteOrigin } from "@/lib/auth/invite";
import type { FormState } from "@/lib/auth/form-state";

/**
 * Betreiber-Team pflegen. Jede Aktion prüft für sich: Betreiber mit
 * Zwei-Faktor-Code und vollem Recht (nicht der Notfallzugang). Es bleibt
 * immer mindestens eine Person mit vollem Recht, und niemand ändert sich
 * selbst – so sperrt sich das Team nicht versehentlich aus.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEIN_RECHT = "Dafür brauchst du vollen Zugriff auf die Konsole.";

export type TeamStand = FormState & { link?: string };

export async function teamAufnehmen(_prev: TeamStand, formData: FormData): Promise<TeamStand> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nurLesen = formData.get("nur_lesen") === "on";
  if (!EMAIL.test(email) || email.endsWith("@privat.invalid")) return { error: "Bitte eine echte E-Mail-Adresse eingeben." };

  const { data: vorhanden, error: suchFehler } = await b.admin.rpc("platform_nutzer_id", { p_email: email });
  if (suchFehler) return { error: "Dafür fehlt noch die Datenbank-Erweiterung (Migration 0223)." };

  let userId = (vorhanden as string | null) ?? null;
  let link: string | undefined;
  if (!userId) {
    const origin = await siteOrigin();
    const einladung = await b.admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${origin}/auth/callback?weiter=/passwort-neu` },
    });
    if (einladung.error || !einladung.data?.user?.id) return { error: "Es ließ sich kein Zugang anlegen." };
    userId = einladung.data.user.id;
    link = buildInviteUrl(origin, einladung.data.properties ?? {}, "invite") ?? undefined;
  } else {
    const { data: schon } = await b.admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (schon) return { error: "Diese Person ist schon im Team." };
  }

  const { error } = await b.admin.from("platform_admins").insert({ user_id: userId, nur_lesen: nurLesen, notiz: "Team" });
  if (error) return { error: "Die Person ließ sich nicht aufnehmen." };
  await betreiberProtokoll(b, "aufgenommen", "team");
  revalidatePath("/plattform/team");
  return link
    ? { success: `${email} ist im Team. Gib den Link persönlich weiter – damit setzt die Person ihr Passwort.`, link }
    : { success: `${email} ist im Team und meldet sich mit dem eigenen Passwort an.` };
}

async function vollesRechtBleibt(b: NonNullable<Awaited<ReturnType<typeof betreiberPruefen>>>, ohne: string): Promise<boolean> {
  const { count } = await b.admin
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true })
    .eq("nur_lesen", false)
    .neq("user_id", ohne);
  return (count ?? 0) > 0;
}

export async function teamEntfernen(userId: string): Promise<{ ok?: boolean; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!UUID.test(userId)) return { error: "Unbekannte Person." };
  if (userId === b.userId) return { error: "Dich selbst kannst du nicht entfernen." };
  if (!(await vollesRechtBleibt(b, userId))) return { error: "Mindestens eine Person braucht vollen Zugriff." };
  const { error } = await b.admin.from("platform_admins").delete().eq("user_id", userId);
  if (error) return { error: "Das Entfernen hat nicht geklappt." };
  await betreiberProtokoll(b, "entfernt", "team");
  revalidatePath("/plattform/team");
  return { ok: true };
}

export async function teamRecht(userId: string, nurLesen: boolean): Promise<{ ok?: boolean; error?: string }> {
  const b = await betreiberPruefen({ aendern: true });
  if (!b) return { error: KEIN_RECHT };
  if (!UUID.test(userId)) return { error: "Unbekannte Person." };
  if (userId === b.userId) return { error: "Dein eigenes Recht kannst du nicht ändern." };
  if (nurLesen && !(await vollesRechtBleibt(b, userId))) return { error: "Mindestens eine Person braucht vollen Zugriff." };
  const { error } = await b.admin.from("platform_admins").update({ nur_lesen: nurLesen }).eq("user_id", userId);
  if (error) return { error: "Das Ändern hat nicht geklappt." };
  await betreiberProtokoll(b, "recht_geaendert", "team");
  revalidatePath("/plattform/team");
  return { ok: true };
}
