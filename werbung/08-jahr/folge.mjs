import { textTippen, knopf } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Dein ganzes Jahr\nauf einen Blick",
  saetze: [
    { text: "Wann ist dein nächstes freies Wochenende?" },
    { text: "Im Monat suchen? Viel zu umständlich.", aktion: async (s) => { await s.page.waitForTimeout(500); await knopf(s, /Ansicht wählen/); } },
    { text: "Jahr antippen.", aktion: async (s) => { await textTippen(s, "Jahr"); } },
    { text: "Zack. Zwölf Monate, jede Schicht in Farbe.", aktion: async (s) => { await s.page.waitForTimeout(900); await s.wischen(270, 700, 0, -300); } },
    { text: "Rot heißt frei. Urlaub planen war nie einfacher.", aktion: async (s) => { await s.wischen(270, 300, 0, 300); } },
    { text: "Oder lieber die Woche?", aktion: async (s) => { await knopf(s, /Ansicht wählen/); await s.page.waitForTimeout(300); await textTippen(s, "Woche"); } },
    { text: "Du entscheidest. Kostenlos.", untertitel: "Du entscheidest. Kostenlos." },
  ],
};
