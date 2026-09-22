-- Ein zusammenhängender Zeitraum ist EIN Antrag.
--
-- Bisher zerlegte submit_leave_auto() einen Zeitraum in mehrere Zeilen --
-- je Block gleicher Art eine. Aus "02.10. bis 06.10." wurden so schnell
-- drei Anträge, die einzeln in der Liste standen und einzeln entschieden
-- werden konnten. Gewollt ist: ein Antrag, ganz genehmigen oder ganz
-- ablehnen.
--
-- Bewusst NICHT gemacht: die Zerlegung abschaffen. Sie ist richtig und
-- muss bleiben -- Urlaubstage und V-Tage gehen auf verschiedene Konten und
-- brauchen deshalb getrennte Zeilen. Geändert wird nur, dass die Zeilen
-- wissen, dass sie zusammengehören.
--
-- Deshalb eine Spalte statt einer Umstrukturierung: leave_requests bleibt
-- wie sie ist, alle bestehenden Abfragen funktionieren unverändert weiter.
-- NULL heisst "steht für sich allein" -- so verhalten sich alle Zeilen,
-- die nie Teil einer gemeinsamen Einreichung waren.
alter table public.leave_requests
  add column if not exists request_group_id uuid;

comment on column public.leave_requests.request_group_id is
  'Klammer um die Zeilen EINER Einreichung. Sie werden gemeinsam genehmigt, abgelehnt und zurueckgezogen. NULL = der Antrag steht fuer sich.';

create index if not exists leave_requests_group_idx
  on public.leave_requests (request_group_id)
  where request_group_id is not null;

-- ---------------------------------------------------------------------------
-- Altbestand nachziehen
-- ---------------------------------------------------------------------------
-- Zeilen aus derselben Einreichung tragen dasselbe created_at: der
-- Einfuegeblock in submit_leave_auto() laeuft in einer Transaktion, und
-- now() ist darin fest. Gemessen am Bestand: 108 aneinandergrenzende
-- Antragspaare haben exakt dasselbe created_at, 5 nicht.
--
-- Zusammengefasst wird deshalb nur, was BEIDES erfuellt: gleiche Person und
-- gleiches created_at UND lueckenlos aneinander. Die 5 Paare, die nur
-- zufaellig aneinandergrenzen, bleiben damit getrennte Antraege -- was sie
-- auch sind. Ein Antrag, der ohnehin allein steht, bleibt auf NULL.
with sortiert as (
  select r.id, r.employee_id, r.created_at, r.start_date, r.end_date,
         lag(r.end_date) over (
           partition by r.employee_id, r.created_at order by r.start_date
         ) as vor_ende
  from public.leave_requests r
  where r.request_group_id is null
),
markiert as (
  select id, employee_id, created_at, start_date,
         -- Neuer Block, sobald eine Luecke kommt.
         sum(case when vor_ende is not null and start_date = vor_ende + 1 then 0 else 1 end)
           over (partition by employee_id, created_at order by start_date
                 rows between unbounded preceding and current row) as block
  from sortiert
),
gruppen as (
  select employee_id, created_at, block,
         count(*) as zeilen,
         (array_agg(id order by start_date))[1] as erste_id
  from markiert
  group by employee_id, created_at, block
)
update public.leave_requests r
   set request_group_id = g.erste_id
  from markiert m
  join gruppen g
    on g.employee_id = m.employee_id
   and g.created_at  = m.created_at
   and g.block       = m.block
 where r.id = m.id
   and g.zeilen > 1;
