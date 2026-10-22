import { reiter, textTippen, knopf } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Deine Schichten.\nDeine Farben.",
  saetze: [
    { text: "Bei dir heißt die Schicht nicht einfach Früh?" },
    { text: "Schichten, meine Schichten.", aktion: async (s) => { await reiter(s, "Schichten"); await s.page.waitForTimeout(300); await textTippen(s, "Meine Schichten"); } },
    { text: "Name, Kürzel, Farbe und Uhrzeit. Alles anpassbar.", aktion: async (s) => { await s.page.waitForTimeout(400); await knopf(s, /^F Früh/); await s.page.waitForTimeout(1200); await knopf(s, "Farbe #C084FC"); } },
    { text: "Lila? Warum nicht. Speichern.", aktion: async (s) => { await s.page.waitForTimeout(900); await knopf(s, "Speichern"); } },
    { text: "Und das Wochenende? Kräftig hervorheben.", aktion: async (s) => { await s.page.waitForTimeout(500); const r = s.page.getByRole("radio", { name: "Kräftig" }); await r.scrollIntoViewIfNeeded(); await s.tippen(r); } },
    { text: "Zurück zum Kalender.", aktion: async (s) => { await reiter(s, "Kalender"); } },
    { text: "Deine Farben. Deine Wochenenden. Sofort im Blick.", untertitel: "Deine Farben. Deine Wochenenden." },
    { text: "Probier es aus. Kostenlos." },
  ],
};
