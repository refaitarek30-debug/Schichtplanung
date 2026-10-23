import { tag, reiter } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Diese App braucht\njeder Schichtarbeiter",
  saetze: [
    { text: "Das ist ShiftNexo. Dein Schichtkalender." },
    { text: "Jede Schicht in ihrer Farbe. Heute rot markiert." },
    { text: "Tag antippen, und du siehst alles.", aktion: async (s) => { await s.page.waitForTimeout(700); await s.tippen(tag(s, "Mittwoch, 28.10.2026")); } },
    { text: "Unter Schichten wird alles gezählt.", aktion: async (s) => { await s.page.keyboard.press("Escape"); await reiter(s, "Schichten"); } },
    { text: "Unter Teilen lädst du Partner und Familie ein.", aktion: async (s) => { await reiter(s, "Teilen"); } },
    { text: "To-dos für zwischen den Schichten.", aktion: async (s) => { await reiter(s, "To-dos"); } },
    { text: "Und das Beste: kostenlos und ohne Werbung.", aktion: async (s) => { await reiter(s, "Kalender"); } },
  ],
};
