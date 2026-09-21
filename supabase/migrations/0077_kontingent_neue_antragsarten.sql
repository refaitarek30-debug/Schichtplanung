-- ---------------------------------------------------------------------------
-- 1) Kontingent je Art
-- ---------------------------------------------------------------------------
-- Urlaub und V-Tage haben ihr Konto in leave_balances_view. Die vier neuen
-- Arten haben keins -- und sollen auch keins bekommen, das nachgeführt
-- werden muss. Ihr Anspruch steht woanders:
--
--   Altersfreizeit  -> age_leave_grants, also das, was die Administration
--                      für das Jahr verbindlich festgelegt hat. Ohne
--                      Festlegung sind es null Tage.
--   die übrigen     -> Jahresobergrenze aus staffing_rules, je Betrieb
--                      einstellbar.
--
-- Verbraucht wird nach Tagen, nicht nach Anträgen, und nur an eingeplanten
-- Arbeitstagen -- dieselbe Zählweise wie in leave_balances_view. Ein
-- Antrag über den Jahreswechsel zählt so in beiden Jahren richtig.
create or replace function public.leave_kind_kontingent(
  p_employee_id uuid,
  p_kind leave_kind,
  p_year int,
  p_ohne_antrag uuid default null
)
returns table (anspruch numeric, verbraucht numeric, rest numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_anspruch numeric;
  v_verbraucht numeric;
begin
  if p_kind in ('urlaub', 'v_tag') then
    raise exception 'Für Urlaub und V-Tage gilt das Urlaubskonto, nicht diese Funktion.';
  end if;

  if p_kind = 'altersfreizeit' then
    select coalesce(g.confirmed_days, 0) into v_anspruch
    from public.age_leave_grants g
    where g.employee_id = p_employee_id and g.year = p_year;
    v_anspruch := coalesce(v_anspruch, 0);
  else
    v_anspruch := company_rule_number(p_kind::text || '_tage_jahr', 'tage', 0);
  end if;

  select count(*) into v_verbraucht
  from public.leave_requests r
  cross join lateral generate_series(r.start_date, r.end_date, interval '1 day') d
  where r.employee_id = p_employee_id
    and r.kind = p_kind
    and r.status in ('approved', 'pending')
    and r.id is distinct from p_ohne_antrag
    and extract(year from d)::int = p_year
    and is_planned_workday(p_employee_id, d::date);

  return query select v_anspruch, coalesce(v_verbraucht, 0), v_anspruch - coalesce(v_verbraucht, 0);
end;
$$;

comment on function public.leave_kind_kontingent(uuid, leave_kind, int, uuid) is
  'Anspruch, Verbrauch und Rest fuer Altersfreizeit, Sonderurlaub, Bildungsurlaub und Gewerkschaftstag. Urlaub und V-Tage haben ihr eigenes Konto.';

revoke all on function public.leave_kind_kontingent(uuid, leave_kind, int, uuid) from public, anon;
grant execute on function public.leave_kind_kontingent(uuid, leave_kind, int, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Prüfung beim Anlegen und beim Genehmigen
-- ---------------------------------------------------------------------------
-- Die Prüfung steht als Trigger in der Datenbank und nicht im Browser:
-- Anträge entstehen über PostgREST, jeder Client könnte eine Prüfung im
-- Formular umgehen.
--
-- Zweimal geprüft wird mit Absicht. Beim Anlegen, damit die Person sofort
-- erfährt, dass das Kontingent nicht reicht. Und noch einmal beim
-- Genehmigen, weil zwischen Antrag und Entscheidung ein anderer Antrag
-- genehmigt worden sein kann.
create or replace function public.leave_requests_check_kontingent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jahr int;
  tage_im_jahr numeric;
  v_rest numeric;
  v_anspruch numeric;
  bezeichnung text;
  darf_bu boolean;
begin
  if new.kind in ('urlaub', 'v_tag') then
    return new;
  end if;
  if new.status not in ('pending', 'approved') then
    return new;
  end if;
  -- Bei einer Änderung nur prüfen, wenn sich etwas Relevantes bewegt.
  if tg_op = 'UPDATE'
     and new.kind = old.kind
     and new.start_date = old.start_date
     and new.end_date = old.end_date
     and new.status = old.status then
    return new;
  end if;

  bezeichnung := case new.kind
    when 'altersfreizeit'   then 'Altersfreizeit'
    when 'sonderurlaub'     then 'Sonderurlaub'
    when 'bildungsurlaub'   then 'Bildungsurlaub'
    when 'gewerkschaftstag' then 'Gewerkschaftstag'
    else new.kind::text end;

  if new.kind = 'bildungsurlaub' then
    select e.bildungsurlaub_erlaubt into darf_bu
    from public.employees e where e.id = new.employee_id;
    if not coalesce(darf_bu, false) then
      raise exception 'Bildungsurlaub ist für diese Person nicht freigegeben. Der Haken dafür steht in der Verwaltung.';
    end if;
  end if;

  -- Ein Antrag kann über den Jahreswechsel gehen; jedes berührte Jahr
  -- wird einzeln gegen sein eigenes Kontingent geprüft.
  for jahr in
    select distinct extract(year from d)::int
    from generate_series(new.start_date, new.end_date, interval '1 day') d
    order by 1
  loop
    select count(*) into tage_im_jahr
    from generate_series(new.start_date, new.end_date, interval '1 day') d
    where extract(year from d)::int = jahr
      and is_planned_workday(new.employee_id, d::date);

    continue when tage_im_jahr = 0;

    select k.anspruch, k.rest into v_anspruch, v_rest
    from public.leave_kind_kontingent(new.employee_id, new.kind, jahr, new.id) k;

    if v_anspruch <= 0 then
      if new.kind = 'altersfreizeit' then
        raise exception 'Für % ist für das Jahr % keine Altersfreizeit festgelegt.', bezeichnung, jahr;
      else
        raise exception 'Für % sind im Jahr % keine Tage vorgesehen.', bezeichnung, jahr;
      end if;
    end if;

    if tage_im_jahr > v_rest then
      raise exception '% im Jahr %: % Tag(e) beantragt, aber nur noch % von % Tag(en) übrig.',
        bezeichnung, jahr, tage_im_jahr::text, v_rest::text, v_anspruch::text;
    end if;
  end loop;

  return new;
end;
$$;

-- Nach leave_requests_set_computed_days, damit requested_days schon steht,
-- und vor dem Benachrichtigungs-Trigger (AFTER).
drop trigger if exists trg_leave_requests_check_kontingent on public.leave_requests;
create trigger trg_leave_requests_check_kontingent
before insert or update on public.leave_requests
for each row execute function public.leave_requests_check_kontingent();
