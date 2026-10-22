import { tag, knopf } from "../werkzeug/hilfen.mjs";
const TAGE = ["Montag, 26.10.2026", "Dienstag, 27.10.2026", "Mittwoch, 28.10.2026", "Donnerstag, 29.10.2026", "Freitag, 30.10.2026"];
export default {
  start: "/privat",
  haken: "Urlaub eintragen?\nSo geht's am schnellsten",
  saetze: [
    { text: "Eine Woche Urlaub eintragen. Wie lange brauchst du dafür?", untertitel: "Eine Woche Urlaub eintragen.\nWie lange brauchst du dafür?" },
    { text: "Pinsel antippen. Urlaub wählen.", untertitel: "Pinsel antippen.\nUrlaub wählen.", aktion: async (s) => { await knopf(s, "Mit dem Pinsel eintragen"); await s.page.waitForTimeout(600); await s.tippen(s.page.getByRole("button", { name: /Urlaub/ }).last()); } },
    { text: "Und über die Tage tippen.", aktion: async (s) => { for (const t of TAGE) { await s.tippen(tag(s, t)); await s.page.waitForTimeout(160); } } },
    { text: "Fertig. Mehr ist es nicht.", untertitel: "Fertig.\nMehr ist es nicht." },
    { text: "Vertippt? Ein Tipp auf Rückgängig.", untertitel: "Vertippt?\nEin Tipp auf Rückgängig.", aktion: async (s) => { await s.page.waitForTimeout(500); await knopf(s, "Rückgängig"); } },
    { text: "Genauso für freie Tage und jede Schicht. Kostenlos.", untertitel: "Genauso für freie Tage\nund jede Schicht. Kostenlos." },
  ],
};
