import { tippe, knopf } from "../werkzeug/hilfen.mjs";
export default {
  stil: "flott", tempo: 0.82, pause: 60,
  start: "/privat/todos",
  haken: "Nach der Nachtschicht\nalles vergessen?",
  saetze: [
    { text: "Nach der Nachtschicht ist der Kopf leer. Kennst du?" },
    { text: "Schreib es einfach auf.", aktion: async (s) => { await tippe(s, s.page.getByPlaceholder(/Neues To-do/), "Rezept abholen"); } },
    { text: "Plus. Gespeichert.", aktion: async (s) => { await knopf(s, "Hinzufügen"); } },
    { text: "Noch eins? Müll rausstellen.", aktion: async (s) => { await tippe(s, s.page.getByPlaceholder(/Neues To-do/), "Müll rausstellen"); await s.page.keyboard.press("Enter"); } },
    { text: "Erledigt? Abhaken.", aktion: async (s) => { await s.page.waitForTimeout(300); await s.tippen(s.page.getByRole("checkbox", { name: /Rezept abholen/ })); } },
    { text: "Dein Kopf ist frei. Für die nächste Schicht.", untertitel: "Kopf frei. Für die nächste Schicht." },
    { text: "Und alles bleibt bei dir. Ohne Werbung, kostenlos." },
  ],
};
