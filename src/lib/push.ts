import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Mitteilungen für Erinnerungen (Web Push, Migration 0155). Je Gerät
 * einzeln: Der Browser fragt um Erlaubnis und gibt eine Adresse, über die
 * der Server Mitteilungen schicken darf.
 *
 * iPhone/iPad: nur, wenn die App vom Home-Bildschirm aus geöffnet ist
 * (ab iOS 16.4). Im normalen Safari-Tab gibt es keine Mitteilungen.
 */

export type PushStatus = "an" | "aus" | "gesperrt" | "nicht-moeglich" | "ios-home";

const SCHLUESSEL = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function istIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function vomHomeBildschirm(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function pushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "nicht-moeglich";
  const moeglich = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!SCHLUESSEL;
  if (!moeglich) return istIos() && !vomHomeBildschirm() ? "ios-home" : "nicht-moeglich";
  if (Notification.permission === "denied") return "gesperrt";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const abo = await reg?.pushManager.getSubscription();
    return abo && Notification.permission === "granted" ? "an" : "aus";
  } catch {
    return "aus";
  }
}

function schluesselBytes(b64: string): Uint8Array<ArrayBuffer> {
  const rein = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const roh = atob(rein);
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

function geraetName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Browser";
}

/** Erlaubnis holen und das Gerät anmelden. */
export async function pushAnschalten(): Promise<PushStatus> {
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") return erlaubnis === "denied" ? "gesperrt" : "aus";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(SCHLUESSEL) }));
  const json = abo.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await createClient().rpc("push_abo_speichern", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_geraet: geraetName(),
  });
  if (error) throw new Error(dataErrorMessage(error) ?? "Das Gerät konnte nicht angemeldet werden.");
  return "an";
}

/** Auf diesem Gerät keine Mitteilungen mehr. */
export async function pushAusschalten(): Promise<PushStatus> {
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) {
    await createClient().rpc("push_abo_entfernen", { p_endpoint: abo.endpoint });
    await abo.unsubscribe().catch(() => undefined);
  }
  return "aus";
}

/** Arten von Mitteilungen, die man abschalten kann (Migration 0159). */
export type MitteilungsArt = "antraege" | "plan" | "einspringen" | "teilen";

export async function fetchPushAus(): Promise<MitteilungsArt[]> {
  const { data, error } = await createClient().rpc("meine_push_vorlieben");
  if (error) return [];
  return ((data ?? []) as MitteilungsArt[]).filter(Boolean);
}

export async function pushAusSetzen(aus: MitteilungsArt[]) {
  const { error } = await createClient().rpc("push_vorlieben_setzen", { p_aus: aus });
  if (error) throw new Error(dataErrorMessage(error) ?? "Das konnte nicht gespeichert werden.");
}
