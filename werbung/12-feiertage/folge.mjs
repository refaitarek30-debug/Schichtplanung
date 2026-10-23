import { reiter } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Arbeitest du\nam Feiertag?",
  saetze: [
    { text: "Feiertag, und du hast trotzdem Schicht? Kennst du." },
    { text: "Hier siehst du alle Feiertage deines Bundeslands." },
    { text: "Tag der Deutschen Einheit: frei. Sehr gut." },
    { text: "Allerheiligen?", aktion: async (s) => { await s.wischen(270, 760, 0, -420); } },
    { text: "Nachtschicht. Na toll.", aktion: async (s) => { await s.page.waitForTimeout(500); } },
    { text: "Bundesland einstellen, fertig.", aktion: async (s) => { await reiter(s, "Mehr"); await s.page.waitForTimeout(400); await s.page.getByText("Bundesland", { exact: false }).first().scrollIntoViewIfNeeded(); } },
    { text: "So siehst du sofort, welche Feiertage du arbeitest.", untertitel: "Sofort sehen, welche Feiertage du arbeitest." },
  ],
};
