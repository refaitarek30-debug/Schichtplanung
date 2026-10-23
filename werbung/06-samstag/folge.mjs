import { tag } from "../werkzeug/hilfen.mjs";
export default {
  start: "/privat",
  haken: "Schichtarbeiter,\nhört auf mit Zetteln!",
  saetze: [
    { text: "Welche Schicht hab ich eigentlich am Samstag?" },
    { text: "Zettel suchen? Im Gruppenchat scrollen?", aktion: async (s) => { await s.wischen(270, 760, 0, -420); await s.page.waitForTimeout(900); await s.wischen(270, 300, 0, 420); } },
    { text: "Nö. Einfach Samstag antippen.", aktion: async (s) => { await s.page.waitForTimeout(700); await s.tippen(tag(s, "Samstag, 24.10.2026")); } },
    { text: "Nachtschicht. Zweiundzwanzig bis sechs Uhr.", untertitel: "Nachtschicht.\n22 bis 6 Uhr." },
    { text: "Und dein ganzes Jahr ist schon drin. Kostenlos.", untertitel: "Dein ganzes Jahr ist schon drin.\nKostenlos.", aktion: async (s) => { await s.page.keyboard.press("Escape"); await s.page.waitForTimeout(500); await s.wischen(270, 760, 0, -420); } },
  ],
};
