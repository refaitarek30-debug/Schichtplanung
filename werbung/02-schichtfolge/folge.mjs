import { reiter } from "../werkzeug/hilfen.mjs";
// Beispieldaten mit LEER=1 starten: der Kalender ist zu Beginn leer.
export default {
  start: "/privat",
  haken: "Ein ganzes Jahr Schichten\nin 10 Sekunden",
  saetze: [
    { text: "Du trägst deine Schichten immer noch einzeln ein?", untertitel: "Du trägst deine Schichten\nimmer noch einzeln ein?" },
    { text: "Mach es einmal richtig.", aktion: async (s) => { await reiter(s, "Mehr"); await s.tippen(s.page.getByText("Schichtfolge eintragen").first()); } },
    { text: "Vorlage antippen. Zwei Früh, zwei Spät, zwei Nacht, zwei frei.", untertitel: "Vorlage antippen:\n2 Früh, 2 Spät, 2 Nacht, 2 frei", aktion: async (s) => { await s.page.waitForTimeout(600); await s.tippen(s.page.getByRole("button", { name: "Je 2 Früh, Spät, Nacht, dann 2 frei" })); } },
    { text: "Eintragen.", aktion: async (s) => { await s.tippen(s.page.getByRole("button", { name: /^Eintragen bis/ })); } },
    { text: "Und das ganze Jahr ist voll.", aktion: async (s) => { await s.page.waitForTimeout(400); await reiter(s, "Kalender"); } },
    { text: "Wischen, nächster Monat. Alles schon drin.", untertitel: "Wischen, nächster Monat.\nAlles schon drin.", aktion: async (s) => { await s.page.waitForTimeout(300); await s.wischen(270, 760, 0, -420); } },
  ],
};
