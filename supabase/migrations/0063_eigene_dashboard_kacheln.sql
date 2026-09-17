-- 0063 – Jede Person entscheidet selbst, welche Kacheln auf ihrem
-- Dashboard stehen.
--
-- Gespeichert werden die *ausgeblendeten* Kacheln, nicht die sichtbaren.
-- Damit ist die Vorgabe „alles sichtbar“, und eine Kachel, die spaeter
-- dazukommt, erscheint bei allen von selbst. Bei einer Liste der
-- sichtbaren Kacheln waere es umgekehrt: alles Neue bliebe unsichtbar,
-- bis jeder es einzeln einschaltet.
--
-- Die Spalte liegt auf `profiles` und nicht im Browser, damit die Auswahl
-- der Person folgt und nicht dem Geraet – wer am Telefon etwas ausblendet,
-- findet es am Rechner genauso wieder.
--
-- Eine neue Regel braucht es nicht: `eigenes Profil aendern` erlaubt
-- bereits, die eigene Zeile zu schreiben, und prueft dabei, dass Rolle,
-- Unternehmen und Aktivkennzeichen unveraendert bleiben.

alter table profiles
  add column if not exists hidden_dashboard_tiles text[] not null default '{}';

comment on column profiles.hidden_dashboard_tiles is
  'Schluessel der Kacheln, die diese Person auf ihrem Dashboard nicht sehen will. Leer = alle sichtbar.';
