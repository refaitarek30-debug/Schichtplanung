/**
 * Läuft ShiftNexo gerade in der iPhone-App (Capacitor, siehe capacitor.config.json)?
 * Die App hängt „ShiftNexoApp“ an die Kennung des Browsers an.
 *
 * In der App keine Hinweise auf Safari oder „Zum Home-Bildschirm“ – das
 * verwirrt und Apple lehnt Apps mit solchen Hinweisen ab.
 */
export function istNativeApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("ShiftNexoApp");
}
