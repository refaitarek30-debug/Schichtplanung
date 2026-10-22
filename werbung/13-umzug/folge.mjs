import { textTippen } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat/mehr",
  haken: "Von deiner alten App\nwechseln? Easy.",
  saetze: [
    { text: "Du nutzt noch eine andere Schicht-App?" },
    { text: "Unter Mehr: aus anderer App übernehmen.", untertitel: "Mehr: Aus anderer App übernehmen", aktion: async (s) => { await textTippen(s, "Aus anderer App übernehmen"); } },
    { text: "Supershift, Google oder iPhone-Kalender.", aktion: async (s) => { await s.page.waitForTimeout(500); await textTippen(s, "Supershift"); } },
    { text: "Kalenderdatei wählen. Oder einfach Screenshots von deinen Monaten.", untertitel: "Kalenderdatei wählen. Oder einfach Screenshots." },
    { text: "Du siehst alles, bevor es übernommen wird.", aktion: async (s) => { await s.wischen(270, 700, 0, -250); } },
    { text: "Und mit einem Tipp ist es wieder rückgängig." },
  ],
};
