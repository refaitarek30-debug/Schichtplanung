import { reiter, knopf } from "../werkzeug/hilfen.mjs";
export default {
  start: "/privat",
  haken: "Wie viele Nachtschichten\nhattest du dieses Jahr?",
  saetze: [
    { text: "Wie viele Nachtschichten hattest du dieses Jahr?", untertitel: "Wie viele Nachtschichten\nhattest du dieses Jahr?" },
    { text: "Keine Ahnung? Die App zählt mit.", untertitel: "Keine Ahnung?\nDie App zählt mit.", aktion: async (s) => { await reiter(s, "Schichten"); } },
    { text: "Früh, Spät, Nacht. Jede Schicht gezählt.", untertitel: "Früh, Spät, Nacht.\nJede Schicht gezählt." },
    { text: "Mit Stunden.", aktion: async (s) => { await s.wischen(270, 760, 0, -380); } },
    { text: "Und für jeden Monat einzeln.", aktion: async (s) => { await s.wischen(270, 300, 0, 380); await s.page.waitForTimeout(500); await knopf(s, "Monat"); } },
    { text: "Perfekt, um die Lohnabrechnung zu prüfen.", untertitel: "Perfekt, um die\nLohnabrechnung zu prüfen." },
  ],
};
