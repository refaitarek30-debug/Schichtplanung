import { reiter } from "../werkzeug/hilfen.mjs";
const farbe = async (s, name) => { const r = s.page.getByRole("radio", { name }); await r.scrollIntoViewIfNeeded(); await s.tippen(r); };
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat",
  haken: "Nachtschicht?\nDann Dunkelmodus.",
  saetze: [
    { text: "Drei Uhr nachts auf den Dienstplan schauen und geblendet werden?", untertitel: "3 Uhr nachts auf den Dienstplan schauen und geblendet werden?" },
    { text: "Unter Mehr: Dunkel.", aktion: async (s) => { await reiter(s, "Mehr"); await farbe(s, "Dunkel"); } },
    { text: "Oder Graphit.", aktion: async (s) => { await s.page.waitForTimeout(300); await farbe(s, "Graphit"); } },
    { text: "Oder Sand. Schön warm.", aktion: async (s) => { await s.page.waitForTimeout(300); await farbe(s, "Sand"); } },
    { text: "Ich nehm Dunkel.", aktion: async (s) => { await farbe(s, "Dunkel"); await s.page.waitForTimeout(300); await reiter(s, "Kalender"); } },
    { text: "Dein Kalender, so wie du ihn magst." },
    { text: "Hell, Dunkel, Graphit oder Sand. Kostenlos, ohne Werbung." },
  ],
};
