-- Altersfreizeit mit eingetragenem Stundenstand, Sonderurlaub ab 55,
-- Geburtsdatum nur einmal selbst eintragbar.
--
-- 1. AF: Administration oder Schichtleitung tragen den aktuellen Stand in
--    Stunden mit Datum ein (z. B. 34 Std. am 25.09.2026). Darauf wird
--    aufgebaut: je tatsächlich gearbeitetem Tag NACH diesem Datum
--    +0,83 Std., je AF-Tag (genommen oder beantragt) -8 Std. Ein AF-Tag
--    geht, solange mindestens 8 Std. da sind.
--
-- 2. Sonderurlaub: 4 Tage je Jahr ab dem Jahr NACH dem 55. Geburtstag
--    (wer 2026 55 wird, hat ab 2027 Anspruch). Der bisherige Haken am
--    Mitarbeiter bleibt als Ausnahme für Jüngere bestehen.
--
-- 3. Geburtsdatum: jede Person trägt es einmal selbst ein. Danach kann nur
--    noch die Administration es ändern – sonst ließe sich der Anspruch
--    durch ein anderes Datum erschleichen.

-- 1 --------------------------------------------------------------------------
alter table public.employees
  add column if not exists af_start_stunden numeric(7,2) not null default 0;

comment on column public.employees.af_start_stunden is
  'AF-Stundenstand zum Stichtag af_ab. Ab dem Folgetag wird darauf aufgebaut.';

drop function if exists public.my_af_konto();
drop function if exists public.af_uebersicht();
drop function if exists public.af_konto(uuid, uuid);

create function public.af_konto(p_employee_id uuid, p_ohne_antrag uuid default null)
returns table (
  freigeschaltet_ab date,
  start_stunden numeric,
  arbeitstage integer,
  stunden_angespart numeric,
  genommen numeric,
  beantragt numeric,
  stand_stunden numeric,
  verfuegbar numeric,
  rest_stunden numeric,
  tage_erworben numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e employees;
  ab date;
  n int;
  angespart numeric;
  gen numeric;
  bea numeric;
  stand numeric;
  tage numeric;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.af_ab is null then
    return query select null::date, 0::numeric, 0, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  ab := e.af_ab;

  -- Gearbeitet = eingeplant, vorbei, ohne jede Abwesenheit und ohne
  -- genehmigten Antrag. Gezählt ab dem Tag NACH dem Stichtag.
  select count(*) into n
    from generate_series(ab + 1, current_date - 1, interval '1 day') g
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  angespart := round(n * 0.83, 2);

  select coalesce(sum(r.requested_days) filter (where r.status = 'approved'), 0),
         coalesce(sum(r.requested_days) filter (where r.status = 'pending'), 0)
    into gen, bea
    from leave_requests r
   where r.employee_id = e.id
     and r.kind = 'altersfreizeit'
     and r.status in ('approved', 'pending')
     and r.start_date > ab
     and r.id is distinct from p_ohne_antrag;

  -- Von der Führung direkt eingetragene AF-Tage zählen ebenso.
  gen := gen + (select count(*) from absences a
                 where a.employee_id = e.id
                   and a.type = 'altersfreizeit'
                   and a.date > ab
                   and not exists (select 1 from leave_requests r
                                    where r.employee_id = e.id
                                      and r.kind = 'altersfreizeit'
                                      and r.status in ('approved', 'pending')
                                      and a.date between r.start_date and r.end_date));

  stand := e.af_start_stunden + angespart - 8 * (gen + bea);
  tage := floor(stand / 8);

  return query select ab, e.af_start_stunden, n, angespart, gen, bea,
                      stand, tage, round(stand - 8 * tage, 2),
                      floor((e.af_start_stunden + angespart) / 8);
end;
$$;

revoke all on function public.af_konto(uuid, uuid) from public, anon, authenticated;

create function public.my_af_konto()
returns table (
  freigeschaltet_ab date,
  start_stunden numeric,
  arbeitstage integer,
  stunden_angespart numeric,
  genommen numeric,
  beantragt numeric,
  stand_stunden numeric,
  verfuegbar numeric,
  rest_stunden numeric,
  tage_erworben numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  return query select * from af_konto(me);
end;
$$;

revoke all on function public.my_af_konto() from public, anon;
grant execute on function public.my_af_konto() to authenticated;

-- Stand eintragen (Administration und Schichtleitung). p_stichtag null =
-- Freischaltung aufheben.
create or replace function public.set_af_stand(p_employee_id uuid, p_stunden numeric, p_stichtag date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_vorher record;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select af_ab, af_start_stunden into v_vorher from employees
   where id = p_employee_id and company_id = v_firma;
  if not found then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_stichtag is not null then
    if p_stichtag < date '2000-01-01' or p_stichtag > current_date then
      raise exception 'Das Datum des Stands darf nicht in der Zukunft liegen.';
    end if;
    if p_stunden is null or p_stunden < -200 or p_stunden > 2000 then
      raise exception 'Bitte einen Stundenstand zwischen -200 und 2000 angeben.';
    end if;
  end if;

  update employees
     set af_ab = p_stichtag,
         af_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
   where id = p_employee_id and company_id = v_firma;

  perform write_audit(v_firma, 'age_leave.stand', 'employees', p_employee_id,
    jsonb_build_object('vorher_ab', v_vorher.af_ab, 'vorher_stunden', v_vorher.af_start_stunden,
                       'nachher_ab', p_stichtag, 'nachher_stunden', p_stunden));
end;
$$;

revoke all on function public.set_af_stand(uuid, numeric, date) from public, anon;
grant execute on function public.set_af_stand(uuid, numeric, date) to authenticated;

-- Die alte Freischaltung ohne Stunden wird nicht mehr gebraucht.
revoke execute on function public.set_af_freischaltung(uuid, date) from public, anon, authenticated;

create function public.af_uebersicht()
returns table (
  employee_id uuid,
  employee_name text,
  rotation_team text,
  birth_date date,
  alter_heute integer,
  freigeschaltet_ab date,
  start_stunden numeric,
  arbeitstage integer,
  stunden_angespart numeric,
  genommen numeric,
  beantragt numeric,
  stand_stunden numeric,
  verfuegbar numeric,
  rest_stunden numeric,
  hat_profil boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         e.first_name || ' ' || e.last_name,
         e.rotation_team::text,
         pd.birth_date,
         case when pd.birth_date is null then null
              else extract(year from age(current_date, pd.birth_date))::int end,
         k.freigeschaltet_ab, k.start_stunden, k.arbeitstage, k.stunden_angespart,
         k.genommen, k.beantragt, k.stand_stunden, k.verfuegbar, k.rest_stunden,
         p.id is not null
    from employees e
    left join profiles p on p.employee_id = e.id and p.company_id = v_firma
    left join personal_details pd on pd.user_id = p.id and pd.company_id = v_firma
    cross join lateral af_konto(e.id) k
   where e.company_id = v_firma
     and e.active
   order by (e.af_ab is null), pd.birth_date nulls last, e.last_name, e.first_name;
end;
$$;

revoke all on function public.af_uebersicht() from public, anon;
grant execute on function public.af_uebersicht() to authenticated;

-- 2 --------------------------------------------------------------------------
create or replace function public.geburtsdatum_von(p_employee_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select pd.birth_date
    from profiles p
    join personal_details pd on pd.user_id = p.id and pd.company_id = p.company_id
   where p.employee_id = p_employee_id
   limit 1;
$$;

revoke all on function public.geburtsdatum_von(uuid) from public, anon, authenticated;

create or replace function public.leave_kind_kontingent(p_employee_id uuid, p_kind leave_kind, p_year integer, p_ohne_antrag uuid default null::uuid)
returns table(anspruch numeric, verbraucht numeric, rest numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_anspruch numeric;
  v_verbraucht numeric;
  k record;
  geb date;
begin
  if p_kind in ('urlaub', 'v_tag') then
    raise exception 'Für Urlaub und V-Tage gilt das Urlaubskonto, nicht diese Funktion.';
  end if;

  if p_kind = 'altersfreizeit' then
    -- Jahresübergreifend aus dem Stundenkonto: verfügbar sind volle 8 Std.
    select * into k from af_konto(p_employee_id, p_ohne_antrag);
    return query select k.tage_erworben, k.genommen + k.beantragt, k.verfuegbar;
    return;
  end if;

  if p_kind = 'sonderurlaub' then
    geb := geburtsdatum_von(p_employee_id);
    -- Ab dem Jahr nach dem 55. Geburtstag: 4 Tage.
    if geb is not null and p_year - extract(year from geb)::int >= 56 then
      v_anspruch := company_rule_number('sonderurlaub_ab_55_tage', 'tage', 4);
    elsif coalesce((select e.sonderurlaub_erlaubt from employees e where e.id = p_employee_id), false) then
      v_anspruch := company_rule_number('sonderurlaub_tage_jahr', 'tage', 0);
    else
      v_anspruch := 0;
    end if;
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
$function$;

revoke execute on function public.leave_kind_kontingent(uuid, leave_kind, integer, uuid)
  from public, anon, authenticated;

create or replace function public.leave_requests_check_kontingent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  jahr int;
  tage_im_jahr numeric;
  tage_gesamt numeric;
  v_rest numeric;
  v_anspruch numeric;
  bezeichnung text;
  darf boolean;
begin
  if new.kind in ('urlaub', 'v_tag') then
    return new;
  end if;
  if new.status not in ('pending', 'approved') then
    return new;
  end if;
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
    select e.bildungsurlaub_erlaubt into darf from public.employees e where e.id = new.employee_id;
    if not coalesce(darf, false) then
      raise exception 'Bildungsurlaub ist für diese Person nicht freigegeben. Der Haken dafür steht in der Verwaltung.';
    end if;
  end if;

  if new.kind = 'altersfreizeit' then
    if (select e.af_ab from public.employees e where e.id = new.employee_id) is null then
      raise exception 'Altersfreizeit ist für diese Person nicht freigeschaltet – es ist noch kein Stundenstand eingetragen.';
    end if;
    select count(*) into tage_gesamt
      from generate_series(new.start_date, new.end_date, interval '1 day') d
     where is_planned_workday(new.employee_id, d::date);
    if tage_gesamt = 0 then
      return new;
    end if;
    select k.rest into v_rest
      from public.leave_kind_kontingent(new.employee_id, new.kind, extract(year from new.start_date)::int, new.id) k;
    if tage_gesamt > v_rest then
      raise exception 'Altersfreizeit: % Tag(e) beantragt, aber nur % Tag(e) verfügbar (je Tag 8 Stunden).',
        tage_gesamt::text, greatest(v_rest, 0)::text;
    end if;
    return new;
  end if;

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
      if new.kind = 'sonderurlaub' then
        raise exception 'Sonderurlaub gibt es ab dem Jahr nach dem 55. Geburtstag (4 Tage im Jahr). Für % besteht kein Anspruch.', jahr;
      end if;
      raise exception 'Für % sind im Jahr % keine Tage vorgesehen.', bezeichnung, jahr;
    end if;

    if tage_im_jahr > v_rest then
      raise exception '% im Jahr %: % Tag(e) beantragt, aber nur noch % von % Tag(en) übrig.',
        bezeichnung, jahr, tage_im_jahr::text, v_rest::text, v_anspruch::text;
    end if;
  end loop;

  return new;
end;
$function$;

revoke execute on function public.leave_requests_check_kontingent() from public, anon, authenticated;

create or replace function public.my_leave_kind_quotas(p_year integer)
returns table(kind leave_kind, anspruch numeric, verbraucht numeric, rest numeric, erlaubt boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select * into e from public.employees where id = me;

  return query
  select a.art,
         k.anspruch, k.verbraucht, k.rest,
         (k.anspruch > 0
          and (a.art <> 'bildungsurlaub' or coalesce(e.bildungsurlaub_erlaubt, false))
          and (a.art <> 'altersfreizeit' or e.af_ab is not null)) as erlaubt
  from (values
    ('altersfreizeit'::leave_kind),
    ('sonderurlaub'::leave_kind),
    ('bildungsurlaub'::leave_kind),
    ('gewerkschaftstag'::leave_kind)
  ) as a(art)
  cross join lateral public.leave_kind_kontingent(me, a.art, p_year) k;
end;
$function$;

create or replace function public.team_sonder_konten(p_year integer default null)
returns table (
  employee_id uuid,
  su_erlaubt boolean,
  su_anspruch numeric,
  su_rest numeric,
  af_freigeschaltet boolean,
  af_verfuegbar numeric,
  af_rest_stunden numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  y int := coalesce(p_year, extract(year from current_date)::int);
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         su.anspruch > 0,
         su.anspruch, su.rest,
         e.af_ab is not null,
         af.verfuegbar, af.rest_stunden
    from employees e
    cross join lateral leave_kind_kontingent(e.id, 'sonderurlaub', y) su
    cross join lateral af_konto(e.id) af
   where e.company_id = auth_company_id()
     and e.active;
end;
$$;

-- 3 --------------------------------------------------------------------------
create or replace function public.personal_details_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Die Administration darf das Geburtsdatum in der eigenen Firma
  -- korrigieren (über set_birth_date). Sonst nur die eigene Zeile.
  if not (is_admin() and new.company_id = auth_company_id()) then
    if new.user_id is distinct from auth.uid()
       or new.company_id is distinct from auth_company_id() then
      raise exception 'Du darfst nur deine eigenen persönlichen Angaben ändern.';
    end if;
    -- Einmal eingetragen, ändert nur noch die Administration: davon hängen
    -- Sonderurlaub und Altersfreizeit ab.
    if tg_op = 'UPDATE'
       and old.birth_date is not null
       and new.birth_date is distinct from old.birth_date then
      raise exception 'Das Geburtsdatum ist bereits eingetragen. Ändern kann es nur die Administration.';
    end if;
  end if;

  new.updated_at := now();

  if new.birth_date is not null
     and new.birth_date > current_date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  end if;

  if new.birth_date is not null
     and new.birth_date < current_date - interval '120 years' then
    raise exception 'Bitte ein gültiges Geburtsdatum eingeben.';
  end if;

  return new;
end;
$function$;

revoke execute on function public.personal_details_guard() from public, anon, authenticated;

create or replace function public.set_birth_date(p_employee_id uuid, p_birth_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_user uuid;
  v_vorher date;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das Geburtsdatum ändern.';
  end if;
  select p.id into v_user from profiles p
   where p.employee_id = p_employee_id and p.company_id = v_firma;
  if v_user is null then
    raise exception 'Diese Person hat noch keinen Zugang – das Geburtsdatum hängt am Zugang.';
  end if;

  select birth_date into v_vorher from personal_details where user_id = v_user;

  insert into personal_details (user_id, company_id, birth_date)
  values (v_user, v_firma, p_birth_date)
  on conflict (user_id) do update set birth_date = excluded.birth_date;

  perform write_audit(v_firma, 'personal_details.birth_date', 'employees', p_employee_id,
    jsonb_build_object('vorher', v_vorher, 'nachher', p_birth_date));
end;
$$;

revoke all on function public.set_birth_date(uuid, date) from public, anon;
grant execute on function public.set_birth_date(uuid, date) to authenticated;
