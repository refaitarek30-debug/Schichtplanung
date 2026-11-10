# Ablauf bei einer Datenpanne

Stand: 10.11.2026 · für den Betreiber von ShiftNexo

Eine Datenpanne liegt vor, wenn Daten von Beschäftigten verloren gehen, verändert werden oder Unbefugte sie sehen konnten.

## Sofort (innerhalb von 1 Stunde)
1. **Stoppen:** betroffenen Zugang sperren, Passwörter und Schlüssel erneuern (Supabase, Vercel, GitHub), notfalls die App vorübergehend abschalten.
2. **Festhalten:** Was ist passiert? Seit wann? Welche Betriebe, welche Daten, wie viele Personen? Uhrzeit notieren, Protokolle sichern (Anmeldeprotokoll, Änderungsprotokoll, Logs bei Vercel und Supabase).

## Innerhalb von 24 Stunden
3. **Betroffene Betriebe informieren** (Ansprechperson laut AV-Vertrag): was passiert ist, welche Daten, was bereits getan wurde, was der Betrieb tun sollte. Der Betrieb ist Verantwortlicher und entscheidet über die Meldung.
4. **Bewerten:** Besteht ein Risiko für die Beschäftigten (z. B. Abwesenheiten oder Kontaktdaten für Fremde sichtbar)?

## Innerhalb von 72 Stunden (Frist nach Art. 33 DSGVO)
5. **Meldung an die Aufsichtsbehörde** durch den Verantwortlichen, wenn ein Risiko besteht. In NRW: Landesbeauftragte für Datenschutz und Informationsfreiheit (LDI NRW). Der Betreiber liefert dafür alle Angaben.
6. **Betroffene Personen informieren**, wenn ein hohes Risiko besteht (Art. 34 DSGVO) – in einfacher Sprache: was, welche Daten, was sie tun können.

## Danach
7. **Ursache beheben** und prüfen, ob dieselbe Lücke an anderer Stelle besteht.
8. **Aufschreiben:** Jede Panne – auch ohne Meldepflicht – mit Datum, Ablauf, Folgen und Maßnahmen dokumentieren (Art. 33 Abs. 5 DSGVO).
9. **Daten wiederherstellen**, falls nötig, aus der nächtlichen Sicherung (`docs/datensicherung.md`).

## Kontakt
Betreiber: siehe Impressum auf shiftnexo.de. Meldungen von Beschäftigten oder Betrieben werden unverzüglich bearbeitet.
