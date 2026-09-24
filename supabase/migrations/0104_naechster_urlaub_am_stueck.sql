-- Der nächste eigene Urlaub „am Stück".
--
-- Ein Urlaub zerfällt oft in mehrere Anträge: Urlaub am Donnerstag, dann
-- zwei freie Tage laut Plan, dann V-Tage. Fachlich ist das ein Urlaub vom
-- ersten bis zum letzten Tag. Zusammengefasst wird, solange zwischen zwei
-- Anträgen nur Tage liegen, an denen man laut Plan ohnehin frei hat.
create or replace function public.mein_naechster_urlaub()
returns table (
  von date,
  bis date,
  tage numeric,
  kalendertage integer,
  arten text[],
  offen boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
  r record;
  b_von date;
  b_bis date;
  b_tage numeric := 0;
  b_arten text[] := '{}';
  b_offen boolean := false;
  luecke_frei boolean;
begin
  if me is null then
    return;
  end if;

  for r in
    select lr.start_date, lr.end_date, lr.requested_days, lr.kind::text as art, lr.status
      from leave_requests lr
     where lr.employee_id = me
       and lr.status in ('approved', 'pending')
       and lr.end_date >= current_date
     order by lr.start_date
  loop
    if b_von is null then
      b_von := r.start_date;
      b_bis := r.end_date;
    else
      if r.start_date > b_bis + 1 then
        select not exists (
          select 1 from generate_series(b_bis + 1, r.start_date - 1, interval '1 day') g
           where is_planned_workday(me, g::date)
        ) into luecke_frei;
        exit when not luecke_frei;
      end if;
      b_bis := greatest(b_bis, r.end_date);
    end if;
    b_tage := b_tage + coalesce(r.requested_days, 0);
    if not (r.art = any(b_arten)) then
      b_arten := b_arten || r.art;
    end if;
    b_offen := b_offen or r.status = 'pending';
  end loop;

  if b_von is null then
    return;
  end if;

  return query select b_von, b_bis, b_tage, (b_bis - b_von + 1)::int, b_arten, b_offen;
end;
$$;

revoke all on function public.mein_naechster_urlaub() from public, anon;
grant execute on function public.mein_naechster_urlaub() to authenticated;
