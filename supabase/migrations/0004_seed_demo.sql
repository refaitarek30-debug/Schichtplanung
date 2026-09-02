-- =============================================================
-- Phase 2 · Beispieldaten für die Entwicklungsumgebung
-- Legt ein Unternehmen mit drei Schichten und 18 Mitarbeitern an.
-- Zusätzlich ein zweites Unternehmen, um die Mandantentrennung testen
-- zu können. Nicht in der Produktivdatenbank ausführen.
-- =============================================================

insert into companies (id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'Muster Produktion GmbH'),
  ('22222222-2222-2222-2222-222222222222', 'Fremdfirma AG')
on conflict (id) do nothing;

insert into shifts (id, company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
values
  ('aaaaaaa1-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Frühschicht', 'F',  '06:00', '14:00', '#16A34A', 6, 7, '{1,2,3,4,5}'),
  ('aaaaaaa1-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Spätschicht', 'S',  '14:00', '22:00', '#F59E0B', 4, 5, '{1,2,3,4,5}'),
  ('aaaaaaa1-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'Nachtschicht', 'N', '22:00', '06:00', '#7C4DE0', 3, 4, '{0,1,2,3,4}'),
  ('aaaaaaa1-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'Tagdienst', 'T',   '08:00', '16:30', '#2F5BEA', 0, 0, '{1,2,3,4,5}'),
  ('bbbbbbb1-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Tagschicht', 'T',  '07:00', '15:30', '#2F5BEA', 2, 3, '{1,2,3,4,5}')
on conflict (id) do nothing;

insert into employees (company_id, personnel_number, first_name, last_name, email, role, department, shift_id, vacation_days)
values
  ('11111111-1111-1111-1111-111111111111', '10001', 'Marco',  'Feldkamp',   'marco.feldkamp@muster-produktion.de',   'shift_leader', 'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10002', 'Tarek',  'Refai',      'tarek.refai@muster-produktion.de',      'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10003', 'Sabine', 'Kraushaar',  'sabine.kraushaar@muster-produktion.de', 'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10004', 'Dennis', 'Oltmann',    'dennis.oltmann@muster-produktion.de',   'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10005', 'Ilona',  'Petzold',    'ilona.petzold@muster-produktion.de',    'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10006', 'Ahmet',  'Yildirim',   'ahmet.yildirim@muster-produktion.de',   'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10007', 'Nadine', 'Brehm',      'nadine.brehm@muster-produktion.de',     'employee',     'Labor',      'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10008', 'Jonas',  'Wieland',    'jonas.wieland@muster-produktion.de',    'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000001', 30),
  ('11111111-1111-1111-1111-111111111111', '10009', 'Katrin', 'Sallmann',   'katrin.sallmann@muster-produktion.de',  'shift_leader', 'Produktion', 'aaaaaaa1-0000-4000-8000-000000000002', 30),
  ('11111111-1111-1111-1111-111111111111', '10010', 'Ruben',  'Achterberg', 'ruben.achterberg@muster-produktion.de', 'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000002', 30),
  ('11111111-1111-1111-1111-111111111111', '10011', 'Melanie','Hoss',       'melanie.hoss@muster-produktion.de',     'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000002', 30),
  ('11111111-1111-1111-1111-111111111111', '10012', 'Piotr',  'Wisniewski', 'piotr.wisniewski@muster-produktion.de', 'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000002', 30),
  ('11111111-1111-1111-1111-111111111111', '10013', 'Elias',  'Grunert',    'elias.grunert@muster-produktion.de',    'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000002', 30),
  ('11111111-1111-1111-1111-111111111111', '10014', 'Halil',  'Dogan',      'halil.dogan@muster-produktion.de',      'shift_leader', 'Produktion', 'aaaaaaa1-0000-4000-8000-000000000003', 30),
  ('11111111-1111-1111-1111-111111111111', '10015', 'Frank',  'Ostermann',  'frank.ostermann@muster-produktion.de',  'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000003', 30),
  ('11111111-1111-1111-1111-111111111111', '10016', 'Yvonne', 'Radke',      'yvonne.radke@muster-produktion.de',     'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000003', 30),
  ('11111111-1111-1111-1111-111111111111', '10017', 'Sven',   'Lorbeer',    'sven.lorbeer@muster-produktion.de',     'employee',     'Produktion', 'aaaaaaa1-0000-4000-8000-000000000003', 30),
  ('11111111-1111-1111-1111-111111111111', '10018', 'Andrea', 'Kuypers',    'andrea.kuypers@muster-produktion.de',   'admin',        'Personal',   'aaaaaaa1-0000-4000-8000-000000000004', 30),
  ('22222222-2222-2222-2222-222222222222', '20001', 'Ines',   'Wagner',     'ines.wagner@fremdfirma.de',             'admin',        'Verwaltung', 'bbbbbbb1-0000-4000-8000-000000000001', 30)
on conflict (company_id, personnel_number) do nothing;

insert into holidays (company_id, date, name, region) values
  ('11111111-1111-1111-1111-111111111111', '2026-01-01', 'Neujahr', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-04-03', 'Karfreitag', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-04-06', 'Ostermontag', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-05-01', 'Tag der Arbeit', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-05-14', 'Christi Himmelfahrt', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-05-25', 'Pfingstmontag', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-06-04', 'Fronleichnam', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-10-03', 'Tag der Deutschen Einheit', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'Allerheiligen', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-12-25', '1. Weihnachtstag', 'NW'),
  ('11111111-1111-1111-1111-111111111111', '2026-12-26', '2. Weihnachtstag', 'NW')
on conflict (company_id, date) do nothing;
