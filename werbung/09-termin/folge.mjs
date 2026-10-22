import { tag, knopf } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Zahnarzt nach der\nNachtschicht? Nein danke.",
  saetze: [
    { text: "Termin machen. Aber welche Schicht hast du dann?" },
    { text: "Tag antippen.", aktion: async (s) => { await s.tippen(tag(s, "Mittwoch, 28.10.2026")); } },
    { text: "Frühschicht. Also Termin am Nachmittag." },
    { text: "Neuer Termin. Zahnarzt.", aktion: async (s) => { await knopf(s, "Neuer Termin"); await s.page.waitForTimeout(700); await knopf(s, /Zahnarzt/); } },
    { text: "Erinnerung einen Tag vorher.", aktion: async (s) => { await knopf(s, "1 Tag vorher"); } },
    { text: "Speichern. Fertig.", aktion: async (s) => { await knopf(s, "Speichern"); } },
    { text: "Schichten und Termine. Endlich in einem Kalender.", untertitel: "Schichten und Termine. Endlich in einem Kalender." },
  ],
};
