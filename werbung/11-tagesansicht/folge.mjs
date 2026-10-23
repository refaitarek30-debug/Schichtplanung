import { tag, knopf } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Wann genau fängt\ndeine Schicht an?",
  saetze: [
    { text: "Schicht ja. Aber ab wann genau?" },
    { text: "Samstag antippen. Tag ansehen.", aktion: async (s) => { await s.tippen(tag(s, "Samstag, 24.10.2026")); await s.page.waitForTimeout(500); await knopf(s, "Tag ansehen"); } },
    { text: "Nachtschicht. Zweiundzwanzig bis sechs Uhr, mit Zeitleiste.", untertitel: "Nachtschicht. 22 bis 6 Uhr, mit Zeitleiste." },
    { text: "Oben tippen: nächster Tag.", aktion: async (s) => { await s.tippen(s.page.getByRole("button", { name: "25.10.2026", exact: true })); } },
    { text: "Sonntag? Wieder Nacht.", aktion: async (s) => { await s.page.waitForTimeout(400); await s.tippen(s.page.getByRole("button", { name: "21.10.2026", exact: true })); } },
    { text: "Mittwoch: Früh. Ab sechs Uhr.", untertitel: "Mittwoch: Früh. Ab 6 Uhr." },
    { text: "Alles auf einen Blick. Ohne Zettel." },
  ],
};
