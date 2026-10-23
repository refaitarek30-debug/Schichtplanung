import { reiter } from "../werkzeug/hilfen.mjs";
// Beispieldaten mit PARTNER=1 starten: Lea ist schon eingeladen.
export default {
  start: "/privat/teilen",
  haken: "„Wann hast du frei?“\nJeden. Einzelnen. Tag.",
  saetze: [
    { text: "Deine Freundin fragt schon wieder, wann du frei hast?", untertitel: "Deine Freundin fragt schon wieder,\nwann du frei hast?" },
    { text: "Lad sie einfach ein. Mit einem Link.", aktion: async (s) => { await s.page.waitForTimeout(500); await s.tippen(s.page.getByText("Lea").first()); await s.page.waitForTimeout(1300); await s.tippen(s.page.getByRole("button", { name: /Schließen/ }).first()); } },
    { text: "Jetzt seht ihr gegenseitig eure Schichten.", untertitel: "Jetzt seht ihr gegenseitig\neure Schichten.", aktion: async (s) => { await reiter(s, "Kalender"); } },
    { text: "Deine oben, ihre direkt darunter.", untertitel: "Deine oben,\nihre direkt darunter." },
    { text: "Gemeinsam frei? Siehst du auf einen Blick.", untertitel: "Gemeinsam frei?\nSiehst du auf einen Blick." },
    { text: "Und Krankmeldungen bleiben privat.", untertitel: "Krankmeldungen bleiben privat." },
  ],
};
