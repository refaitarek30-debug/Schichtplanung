# Weitermachen – Prompt für die nächste Sitzung

Stand 10.11.2026, nach #209. Diesen Text als Auftrag einfügen:

> Lies `docs/review/11-stand.md` und `docs/review/12-weiter.md` (Branch `claude/review-2026-11`).
> Arbeite die offenen Punkte der Reihe nach ab, sparsam, je Punkt ein kleiner PR, einfache Sprache.

## Erledigt heute (live)
- #207 Urlaub: „Trotzdem genehmigen?“ bei Unterbesetzung, Schalter eigene Anträge der Schichtleitung (Migration 0213 eingespielt)
- #208 „Wen sehe ich?“ als Seitenblatt, eigene Schichten ausblendbar, Privatkalender lädt schneller
- #209 Große Farbauswahl (Pastell/Kräftig/Eigene), Häkchen schaltet beides, Farben unter dem Regler, neue App-Fassung kommt sofort an

## Offen – der Reihe nach
1. **Rückmeldung abwarten:** Fühlt sich das Hereinziehen von „Wen sehe ich?“ auf dem iPhone gut an? Passt Größe/Breite? (nur im Test nachgestellt)
2. **Alter Eintrag „Partner“** (kalender_personen, ohne Link, 2 Tage): Nutzer entfernt ihn selbst unter Teilen → Partner → Entfernen. Nur auf Wunsch SQL liefern.
3. **Frage offen (D-05):** Geburtsdatum weiter für Schichtleitung sichtbar oder nur Administration? Erst nach Antwort umsetzen (Altersfreizeit-Seite nutzt `team_birth_dates`).
4. **Probe-Wiederherstellung** der Datensicherung (Artefakt aus GitHub Actions) – Anleitung für den Nutzer schreiben.
5. **D-02 Löschfristen, D-04 Datenkopie (Auskunft), D-08 Unterlagen** (Löschkonzept, Pannen-Ablauf, Berechtigungskonzept) – für das Betriebsrat-Gespräch am Donnerstag zuerst D-08 als kurze Dokumente.
6. **Rollenmodell** (Aufgabe #118), **App-Store-Prüfung** (Capacitor) – später.

## Nutzer macht selbst (nur erinnern)
Zwei-Faktor für Supabase/Vercel/GitHub/Brevo, Passwort-Mindestlänge 12, UptimeRobot (https://shiftnexo.de/api/version und /login), Brevo-AV-Vertrag als PDF ablegen.

## Regeln (kurz)
Kein Secret im Chat; Migrationen spielt der Nutzer ein, danach nur lesend prüfen; `tsconfig.tsbuildinfo` nie committen; Merge mit vollem SHA erst bei grüner Prüfung; Neuigkeiten pflegen; Rechtstext-Änderung → Version + Migration.
