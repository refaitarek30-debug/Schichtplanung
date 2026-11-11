# Monatlicher Dienstplan – Entwurf (Schritt 1)

Stand: 11.11.2026 · **nur Beschreibung.** Nichts hiervon ist angewendet: keine
Migration, keine Änderung an der Datenbank, kein Code. Die Bildentwürfe liegen
auf der Entwurfs-Leinwand (Link im Gespräch).

## 1. Was es schon gibt und weiterverwendet wird

| Vorhanden | Wofür im Monatsmodus |
|---|---|
| `shift_assignments` (eine Zeile je Person und Tag, sticht das Rotationsmuster) und `effective_shift_id()` | **Ist bereits der Monatsplan.** Ohne Muster ist die Tageszeile der Plan. Besetzung, Urlaubstage, „Mein Kalender“ und das Kalender-Abo lesen alle darüber. |
| `shifts` (Name, Kürzel, Beginn, Ende, Farbe) | Schichtarten. Es fehlen nur Pause und der zweite Zeitblock. |
| `qualifications`, `employee_qualifications`, `shift_qualification_needs` (0050, 0060) | Qualifikationen und Mindestbesetzung je Schichtart und Qualifikation – Tabelle und Raster in den Einstellungen sind da. |
| `staffing_rules` mit `company_rule_number()` (Ruhezeit 11 h steht schon drin) | Prüfregeln: Ruhezeit, höchstens Nächte/Dienste am Stück. Neue Schlüssel, keine neue Tabelle. |
| Lücken- und Ersatzsuche (0056, 0057, `replacement_requests`) | „Wer könnte übernehmen?“ im Planraster und der Antwortweg für den Tausch. |
| `leave_requests` mit Genehmigung | Urlaub in der Wunschphase bleibt ein normaler Urlaubsantrag. |
| `notifications`, Push, `email_outbox` | Erinnerung vor Fristende, Mitteilung bei Veröffentlichung und Änderung. |
| `audit_logs` und Seite Protokoll | Änderungen nach der Veröffentlichung. |
| `kalender_abo` und `/abo/[token]` | Kalender-Abo (iCal) – heute nur für freigeschaltete Personen. |
| Druck A4 quer über den Druckdialog (`src/components/privat/export.tsx`) | Gleiche Technik für den Aushang, ohne zusätzliche Bibliothek. |
| Einrichtungsassistent `/einrichtung`, Schritt „Schichtsystem“ | Dort sitzt die Wahl des Planungsmodus. |
| Schalter „Abwesenheitsgründe für Kollegen“ (`company_settings`) | Datenschutz-Vorgabe: Kollegen sehen nur „abwesend“. |
| Entwurf `supabase/entwuerfe/rollen_zusatzrechte.sql` | Grundlage für Zusatzrollen. |

Nicht vorhanden, anders als angenommen: Abwesenheitsarten des **Betriebs** sind
heute eine feste Liste (`absence_type`). Frei anlegbar sind nur die eigenen Arten
im persönlichen Kalender. Für den Prototyp reicht die feste Liste.

## 2. Vorschlag: Planungsmodus

Eine Einstellung je Betrieb, drei Werte: `rotation` (wie heute), `monat`,
`keine` (Montag bis Freitag). Gewählt im Assistenten, später änderbar.

Der Modus schaltet nur zwei Dinge:

1. **Woher der Plan kommt.** Rotation: Muster plus Ausnahmen. Monat: nur die
   Tageszeilen in `shift_assignments`, kein Muster.
2. **Ob es einen Monatsstatus gibt.** Im Monatsmodus hat jeder Monat einen Stand
   (Wünsche → Entwurf → Prüfung → Genehmigung → veröffentlicht). Mitarbeitende
   sehen Tageszeilen erst, wenn der Monat veröffentlicht ist.

Warum so: `effective_shift_id()` ist heute schon die eine Stelle, durch die alles
liest. Es kommt dort eine einzige Regel dazu („Entwurf ist für Mitarbeitende
unsichtbar“). Besetzung, Urlaubsberechnung, Kalender, Abo und Auswertung bleiben
unverändert, und Betriebe mit Rotation merken nichts.

Offen: Ein Krankenhaus hat mehrere Stationen. Entweder je Station ein eigener
Betrieb (geht heute schon, strikt getrennt) oder ein Betrieb mit Bereichen. Der
Monatsstatus bekommt deshalb von Anfang an ein leeres Feld „Bereich“.

## 3. Vorschlag: Rollen

- Die drei Stufen `employee`, `shift_leader`, `admin` bleiben, wie sie sind. Alle
  Zugriffsregeln hängen daran.
- **Anzeigenamen** je Betrieb: drei Textfelder, rein Beschriftung (wie heute
  „V-Tag“ über `useBegriffe`).
- **Zusatzrollen**: Name plus Häkchen aus einer **festen Liste** von Rechten.
  Vorgesehen: Plan genehmigen, Plan bearbeiten, Wünsche aller sehen, Tausch
  bestätigen, Abwesenheitsgründe sehen.

So bleibt es sicher:

1. Rechte der Administration (Rollen vergeben, Einstellungen, Personen löschen)
   stehen **nicht in der Liste**. Was nicht wählbar ist, kann niemand versehentlich
   vergeben.
2. Zusatzrollen anlegen und vergeben darf nur die Administration; niemand ändert
   die eigene Rolle (Wächter `employees_guard_role_change` gibt es schon).
3. Die letzte Administration lässt sich nicht herabstufen.
4. Optional Vier-Augen-Prinzip: Wer einreicht, genehmigt nicht selbst.
5. Durchgesetzt in der Datenbank (`hat_zusatzrecht()` aus dem Entwurf), nicht nur
   in der Oberfläche. Jede Änderung steht im Protokoll.

Abweichung vom bestehenden Entwurf: Dort sind die Rechte drei feste Spalten und
nur für die Schichtleitung. Für „Freigabe“ braucht es eine Zeile je Recht und die
Möglichkeit, sie auch jemandem ohne Planungsrecht zu geben (z. B. Pflegedienstleitung).

## 4. Datenmodell-Erweiterungen

**Bestehende Tabellen, neue Spalten**

| Tabelle | Neu | Zweck |
|---|---|---|
| `company_settings` | `planungsmodus`, `branche`, `wunsch_frist_monate` (3), `wunsch_erinnerung_tage` (7), `veroeffentlichung_tag` (15), `rollen_namen` (jsonb), `vier_augen` | Modus, Fristen, Anzeigenamen |
| `shifts` | `pause_minuten`, `art` (`dienst` / `frei`), `sortierung` | Pause, „Frei“ als Schichtart |
| `shift_qualification_needs` | `wochentage` (leer = alle) | später andere Werte am Wochenende |
| `staffing_rules` | Schlüssel `max_naechte_am_stueck`, `max_dienste_am_stueck` | Prüfregeln |
| `shift_assignments` | `plan_monat_id`, `geaendert_von`, `geaendert_am` | Zuordnung zum Monat, Nachvollziehbarkeit |

**Neue Tabellen**

| Tabelle | Inhalt |
|---|---|
| `shift_zeitbloecke` | Je Schichtart ein oder mehrere Blöcke (`beginn`, `ende`, Reihenfolge). Geteilter Dienst = zwei Zeilen. Stunden und Besetzung rechnen je Block; endet ein Block vor seinem Beginn, läuft er über Mitternacht. `shifts.start_time/end_time` bleiben als Rahmen stehen, damit Bestehendes weiterläuft. |
| `plan_monate` | Je Betrieb (und Bereich) und Monat: `status`, Wunschfrist, Stichtag, Version, eingereicht/genehmigt/veröffentlicht von wem und wann. |
| `plan_wuensche` | Person, Tag, Art (`schicht` mit Schichtart oder `frei`), abgegeben am. Urlaub steht **nicht** hier, sondern bleibt `leave_requests`. Erfüllt oder nicht wird aus Wunsch und Plan berechnet, nicht gespeichert. |
| `plan_versionen` | Eingefrorener Stand je Genehmigung/Veröffentlichung (für „Stand/Version“ auf dem Ausdruck und für „was hat sich geändert“). |
| `tausch_anfragen` | Wer, welcher Tag, mit wem, Status (offen → Kollege einverstanden → von Leitung bestätigt / abgelehnt). Nach dem Muster von `replacement_requests`. |
| `rollen`, `rollen_rechte` | Zusatzrollen und ihre Rechte (eine Zeile je Recht aus der festen Liste); Zuweisung an `employees`. |

**Funktionen (alle nach dem bestehenden Muster: Prüfung in der Datenbank)**

- `effective_shift_id()`: zusätzliche Regel für unveröffentlichte Monate.
- `plan_pruefung(monat)`: liefert die Hinweise (Unterbesetzung, Qualifikation,
  Ruhezeit, Nächte/Dienste am Stück, Soll/Ist). Nur lesend, ändert nichts.
- `plan_einreichen()`, `plan_genehmigen()`, `plan_veroeffentlichen()`: Statuswechsel
  mit Rechteprüfung und Protokoll.
- `tausch_bestaetigen()`: tauscht zwei Tageszeilen in einem Schritt, prüft vorher
  Ruhezeit und Qualifikation, benachrichtigt beide.

## 5. Datenschutz: was neu gespeichert würde

| Neu | Wer sieht es | Löschung (Vorschlag) |
|---|---|---|
| Wünsche (Tag, Wunschschicht oder Wunschfrei) | die Person selbst, Leitung, Rolle mit Recht „Wünsche sehen“ | 12 Monate nach Monatsende |
| Monatsstatus, Versionen, wer genehmigt hat | Leitung; Mitarbeitende nur Stand und Datum | wie der Plan |
| Tauschanfragen | die zwei Beteiligten und die Leitung | 12 Monate |
| Änderungen nach Veröffentlichung | Leitung im Protokoll; Betroffene als Mitteilung | 24 Monate (wie bisher) |

Unverändert: keine Diagnosen, keine Freitexte zu Gesundheit; Kollegen sehen
standardmäßig nur „abwesend“. Zu klären mit Personalrat/Datenschutz: ob aus
Wünschen eine Auswertung je Person entstehen darf („wie oft erfüllt“) – im Entwurf
gibt es sie nur als Summe für den ganzen Monat.

## 6. Für Schritt 2 (Prototyp) vorgesehen

Eigene Seiten im Demo-Modus mit Beispieldaten im Speicher (30 erfundene
Personen, drei Monate in drei Ständen), ohne Supabase. Der Rollenwechsler des
Demo-Modus (`setRole`) wird für „Chef / Mitarbeiter“ weiterverwendet.
