// Kleine Bausteine für die Folgen.
export const tag = (s, datum) => s.page.locator(`button[aria-label^="${datum}"]`).first();
export async function reiter(s, name) {
  // Untere Leiste: Kalender, Schichten, Teilen, To-dos, Mehr
  await s.tippen(s.page.locator("nav a, nav button").filter({ hasText: name }).last());
  await s.page.waitForLoadState("networkidle");
}
export async function knopf(s, name) {
  const k = s.page.getByRole("button", { name }).first();
  if (await k.count()) await s.tippen(k);
}
export async function textTippen(s, t) {
  await s.tippen(s.page.getByText(t, { exact: true }).first());
}
export async function tippe(s, feld, wert) {
  await s.tippen(feld);
  await feld.pressSequentially(wert, { delay: 55 });
}
