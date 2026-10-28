"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { datenFehlerText } from "@/lib/errors";
import { LEGAL_VERSIONS } from "@/lib/legal/version";
import { START_COOKIE, START_COOKIE_MAX_AGE, startCookieWert } from "@/lib/start-seite";
import type { FormState } from "./form-state";

/*
 * Ein Konto, zwei Bereiche (Migration 0194): Austritt und Beitritt.
 * Alle Prüfungen macht die Datenbank – hier wird nur weitergereicht.
 */

/** Nach dem Austritt: privat weitermachen (Termine, To-dos, eigene Einträge, Farben gehen mit). */
export async function privatWeitermachen(): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Gerade nicht möglich." };
  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
  const { error } = await supabase.rpc("privat_weitermachen", { p_version: LEGAL_VERSIONS.datenschutz });
  if (error) return { error: datenFehlerText(error, "Das hat nicht geklappt. Bitte versuch es noch einmal.") };
  // Ab jetzt startet die App im Privatbereich.
  (await cookies()).set(START_COOKIE, startCookieWert(userId, "privat"), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: START_COOKIE_MAX_AGE,
  });
  revalidatePath("/", "layout");
  redirect("/privat");
}

/** Mit dem bestehenden Konto einem Betrieb beitreten – nach der Übernahme-Frage. */
export async function betriebBeitreten(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Gerade nicht möglich." };
  const code = String(formData.get("code") ?? "");
  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
  const { error } = await supabase.rpc("beitritt_annehmen", {
    p_code: code,
    p_termine: formData.get("termine") === "on",
    p_todos: formData.get("todos") === "on",
    p_schichten: formData.get("schichten") === "on",
  });
  if (error) return { error: datenFehlerText(error, "Der Beitritt hat nicht geklappt. Bitte versuch es noch einmal.") };
  // Startseite wieder der Betrieb (der Merker „privat“ gilt nicht mehr).
  (await cookies()).set(START_COOKIE, startCookieWert(userId, null), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: START_COOKIE_MAX_AGE,
  });
  revalidatePath("/", "layout");
  redirect("/start");
}
