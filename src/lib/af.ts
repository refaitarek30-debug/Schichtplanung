/** Stunden je AF-Tag. */
export const AF_STUNDEN_JE_TAG = 8;

/**
 * Wie viele ganze AF-Tage der aktuelle Stand hergibt. Bewusst ohne die schon
 * eingeplanten Tage – angezeigt wird nur, was heute auf dem Konto ist.
 */
export function afTageAusStand(stunden: number): number {
  return Math.max(Math.floor(stunden / AF_STUNDEN_JE_TAG + 1e-9), 0);
}
