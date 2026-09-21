-- Neue Antragsarten: Grundlage.
--
-- Bisher kannte ein Urlaubsantrag genau zwei Arten: Urlaub und V-Tag.
-- Sonderurlaub, Bildungsurlaub und Altersfreizeit gab es nur als
-- Abwesenheit, die die Führung von Hand einträgt -- die betroffene Person
-- konnte sie nicht selbst beantragen. Gewerkschaftstag fehlte ganz.
--
-- Diese Migration legt nur die Grundlage: die Enum-Werte, das Kennzeichen
-- am Mitarbeiter und die Jahresobergrenzen. Alles, was die neuen Werte
-- benutzt, steht in 0077 -- ein neuer Enum-Wert lässt sich nicht
-- zuverlässig in derselben Transaktion verwenden, in der er entsteht.
--
-- Wichtig: die automatische Verteilung bleibt unberührt.
-- `submit_leave_auto()` und `suggest_leave_kind()` vergeben ausschliesslich
-- 'urlaub' und 'v_tag'. Die neuen Arten kommen dort nicht vor und können
-- dort auch nicht entstehen -- sie muss die betroffene Person bewusst
-- auswählen. Genau so ist es gewollt.
--
-- Ebenfalls unberührt: leave_balances_view. Die Sicht zählt ausdrücklich
-- nur `kind = 'urlaub'` und `kind = 'v_tag'`. Die neuen Arten gehen
-- deshalb weder vom Urlaubs- noch vom V-Tage-Konto ab. Ihr Kontingent
-- steht woanders (0077).

alter type leave_kind add value if not exists 'altersfreizeit';
alter type leave_kind add value if not exists 'sonderurlaub';
alter type leave_kind add value if not exists 'bildungsurlaub';
alter type leave_kind add value if not exists 'gewerkschaftstag';

-- Bildungsurlaub hängt an der einzelnen Person, nicht am Betrieb: ohne
-- Haken steht die Art im Antragsformular gar nicht zur Wahl, und ein
-- Antrag wird abgewiesen (Prüfung in 0077).
alter table public.employees
  add column if not exists bildungsurlaub_erlaubt boolean not null default false;

comment on column public.employees.bildungsurlaub_erlaubt is
  'Darf diese Person Bildungsurlaub beantragen? Vorgabe: nein. Wird in der Verwaltung je Mitarbeiter gesetzt.';

-- Jahresobergrenzen je Art. Sie gehören dem Betrieb, nicht dem Programm,
-- und stehen deshalb in staffing_rules wie Ruhezeit und Schichtdauer.
-- Die Vorgabewerte sind ein Startpunkt, kein Rechtsrat -- massgeblich ist,
-- was der Betrieb hier einträgt.
--
-- staffing_rules hat `unique (company_id, shift_id, key)`, und NULL gilt
-- im UNIQUE als verschieden. Für betriebsweite Regeln greift `on conflict`
-- deshalb nicht; stattdessen `where not exists`.
insert into staffing_rules (company_id, shift_id, key, value)
select c.id, null, v.key, v.value
  from companies c
  cross join (values
    ('sonderurlaub_tage_jahr',     '{"tage": 3}'::jsonb),
    ('bildungsurlaub_tage_jahr',   '{"tage": 5}'::jsonb),
    ('gewerkschaftstag_tage_jahr', '{"tage": 3}'::jsonb)
  ) as v(key, value)
 where not exists (
   select 1 from staffing_rules r
    where r.company_id = c.id and r.shift_id is null and r.key = v.key
 );
