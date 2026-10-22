import { tippe } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60, ohneSitzung: true,
  start: "/privat/registrieren",
  haken: "In 20 Sekunden\nstartklar",
  saetze: [
    { text: "Keine Lust auf lange Anmeldungen?" },
    { text: "Spitzname.", aktion: async (s) => { await tippe(s, s.page.locator('input[name="spitzname"]'), "nachtfalke"); } },
    { text: "Passwort.", aktion: async (s) => { await tippe(s, s.page.locator('input[name="password"]'), "Sehrgeheim24"); } },
    { text: "Keine E-Mail. Kein echter Name. Keine Werbung.", untertitel: "Keine E-Mail. Kein Name. Keine Werbung." },
    { text: "Häkchen, und los.", aktion: async (s) => { await s.tippen(s.page.locator('input[name="datenschutz"]')); } },
    { text: "Danach Schichtfolge eintragen, und dein ganzes Jahr ist voll." },
    { text: "Kostenlos. Auf shiftnexo punkt de.", untertitel: "Kostenlos: shiftnexo.de" },
  ],
};
