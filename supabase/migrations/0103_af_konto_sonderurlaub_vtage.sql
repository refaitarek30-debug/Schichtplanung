-- Altersfreizeit als Stundenkonto, Sonderurlaub nur mit Haken, V-Tage
-- dürfen ins Minus, Sammelgenehmigung je Jahr und Antrag für Antrag.
--
-- 1. Altersfreizeit (AF)
--    Wer freigeschaltet ist, bekommt für jeden tatsächlich gearbeiteten Tag
--    0,83 Stunden gutgeschrieben. Je volle 7,5 Stunden entsteht ein AF-Tag.
--    Gearbeitet heißt: eingeplanter Arbeitstag, der schon vorbei ist, ohne
--    jede Abwesenheit (krank, Schulung, …) und ohne genehmigten Antrag
--    (Urlaub, V-Tag, AF, …). Bei allem anderen gibt es nichts – ohne
--    Ausnahme. Das Konto läuft über die Jahre weiter (Übertrag).
--    Freigeschaltet wird mit einem Datum („ab"), gepflegt von der
--    Administration. Bisher bestätigte Tage (age_leave_grants) bleiben als
--    Protokoll stehen; wer dort Tage > 0 hatte, ist ab 1.1. dieses Jahres
--    freigeschaltet.
--
-- 2. Sonderurlaub nur mit Haken „Sonderurlaub berechtigt" am Mitarbeiter.
--    Wer schon Sonderurlaub beantragt oder genehmigt hat, bekommt den Haken,
--    damit nichts Bestehendes ungültig wird.
--
-- 3. V-Tage dürfen ins Minus: sind Urlaub und V-Tage aufgebraucht, geht
--    trotzdem ein V-Tag. Geprüft wird bei der Genehmigung nur noch das
--    Urlaubskonto.
--
-- 4. Sammelgenehmigung: die App holt die offenen Anträge (optional eines
--    Jahres) und prüft sie nacheinander einzeln – dieselbe Prüfung wie
--    bisher, nur ohne Zeitlimit-Gefahr bei vielen Anträgen.

-- 1 + 2: Spalten -------------------------------------------------------------
alter table public.employees
  add column if not exists af_ab date,
  add column if not exists sonderurlaub_erlaubt boolean not null default false;

comment on column public.employees.af_ab is
  'Altersfreizeit freigeschaltet ab diesem Tag (null = nicht freigeschaltet).';
comment on column public.employees.sonderurlaub_erlaubt is
  'Darf Sonderurlaub beantragen.';

update public.employees e
   set af_ab = make_date(x.jahr, 1, 1)
  from (select employee_id, min(year) as jahr
          from public.age_leave_grants
         where confirmed_days > 0
         group by employee_id) x
 where e.id = x.employee_id
   and e.af_ab is null;

update public.employees e
   set sonderurlaub_erlaubt = true
 where exists (select 1 from public.leave_requests r
                where r.employee_id = e.id
                  and r.kind = 'sonderurlaub'
                  and r.status in ('pending', 'approved'));

-- 1: das AF-Konto ------------------------------------------------------------
create or replace function public.af_konto(p_employee_id uuid, p_ohne_antrag uuid default null)
returns table (
  freigeschaltet_ab date,
  arbeitstage integer,
  stunden numeric,
  tage_erworben numeric,
  rest_stunden numeric,
  genommen numeric,
  beantragt numeric,
  verfuegbar numeric
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
  std numeric;
  erw numeric;
  gen numeric;
  bea numeric;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.af_ab is null then
    return query select null::date, 0, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  ab := greatest(e.af_ab, coalesce(e.entry_date, e.af_ab));

  select count(*) into n
    from generate_series(ab, current_date - 1, interval '1 day') g
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  std := round(n * 0.83, 2);
  erw := floor(std / 7.5);

  select coalesce(sum(r.requested_days) filter (where r.status = 'approved'), 0),
         coalesce(sum(r.requested_days) filter (where r.status = 'pending'), 0)
    into gen, bea
    from leave_requests r
   where r.employee_id = e.id
     and r.kind = 'altersfreizeit'
     and r.status in ('approved', 'pending')
     and r.id is distinct from p_ohne_antrag;

  -- Von der Führung direkt eingetragene AF-Tage zählen ebenso.
  gen := gen + (select count(*) from absences a
                 where a.employee_id = e.id
                   and a.type = 'altersfreizeit'
                   and a.date >= ab
                   and not exists (select 1 from leave_requests r
                                    where r.employee_id = e.id
                                      and r.kind = 'altersfreizeit'
                                      and r.status in ('approved', 'pending')
                                      and a.date between r.start_date and r.end_date));

  return query select ab, n, std, erw, round(std - erw * 7.5, 2), gen, bea, erw - gen - bea;
end;
$$;

revoke all on function public.af_konto(uuid, uuid) from public, anon, authenticated;

create or replace function public.my_af_konto()
returns table (
  freigeschaltet_ab date,
  arbeitstage integer,
  stunden numeric,
  tage_erworben numeric,
  rest_stunden numeric,
  genommen numeric,
  beantragt numeric,
  verfuegbar numeric
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

-- Freischalten / aufheben (Administration)
create or replace function public.set_af_freischaltung(p_employee_id uuid, p_ab date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_vorher date;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select af_ab into v_vorher from employees
   where id = p_employee_id and company_id = v_firma;
  if not found then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_ab is not null and (p_ab < date '2000-01-01' or p_ab > current_date + 366) then
    raise exception 'Ungültiges Datum.';
  end if;

  update employees set af_ab = p_ab where id = p_employee_id and company_id = v_firma;

  perform write_audit(v_firma, 'age_leave.freischaltung', 'employees', p_employee_id,
    jsonb_build_object('vorher', v_vorher, 'nachher', p_ab));
end;
$$;

revoke all on function public.set_af_freischaltung(uuid, date) from public, anon;
grant execute on function public.set_af_freischaltung(uuid, date) to authenticated;

-- Übersicht für die Administration
create or replace function public.af_uebersicht()
returns table (
  employee_id uuid,
  employee_name text,
  rotation_team text,
  birth_date date,
  alter_heute integer,
  freigeschaltet_ab date,
  arbeitstage integer,
  stunden numeric,
  tage_erworben numeric,
  rest_stunden numeric,
  genommen numeric,
  beantragt numeric,
  verfuegbar numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         e.first_name || ' ' || e.last_name,
         e.rotation_team::text,
         pd.birth_date,
         case when pd.birth_date is null then null
              else extract(year from age(current_date, pd.birth_date))::int end,
         k.freigeschaltet_ab, k.arbeitstage, k.stunden, k.tage_erworben,
         k.rest_stunden, k.genommen, k.beantragt, k.verfuegbar
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

-- Kontingente: AF aus dem Stundenkonto, Sonderurlaub nur mit Haken ----------
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
begin
  if p_kind in ('urlaub', 'v_tag') then
    raise exception 'Für Urlaub und V-Tage gilt das Urlaubskonto, nicht diese Funktion.';
  end if;

  if p_kind = 'altersfreizeit' then
    -- Jahresübergreifend: angespart minus genommen und beantragt.
    select * into k from af_konto(p_employee_id, p_ohne_antrag);
    return query select k.tage_erworben, k.genommen + k.beantragt, k.verfuegbar;
    return;
  end if;

  if p_kind = 'sonderurlaub'
     and not coalesce((select e.sonderurlaub_erlaubt from employees e where e.id = p_employee_id), false) then
    v_anspruch := 0;
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

  if new.kind = 'sonderurlaub' then
    select e.sonderurlaub_erlaubt into darf from public.employees e where e.id = new.employee_id;
    if not coalesce(darf, false) then
      raise exception 'Sonderurlaub ist für diese Person nicht freigegeben. Der Haken dafür steht in der Verwaltung.';
    end if;
  end if;

  if new.kind = 'altersfreizeit' then
    if (select e.af_ab from public.employees e where e.id = new.employee_id) is null then
      raise exception 'Altersfreizeit ist für diese Person nicht freigeschaltet.';
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
      raise exception 'Altersfreizeit: % Tag(e) beantragt, aber nur % Tag(e) angespart.',
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
          and (a.art <> 'sonderurlaub' or coalesce(e.sonderurlaub_erlaubt, false))
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

-- Konten für die Führung (Meine Schicht) -------------------------------------
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
         e.sonderurlaub_erlaubt,
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

revoke all on function public.team_sonder_konten(integer) from public, anon;
grant execute on function public.team_sonder_konten(integer) to authenticated;

-- 3: V-Tage dürfen ins Minus -------------------------------------------------
create or replace function public.decide_leave_request(p_request_id uuid, p_decision leave_status, p_rejection_reason text default null::text)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result leave_requests;
  v_firma uuid := auth_company_id();
  v_gruppe uuid;
  v_anzahl int;
  fehlend text;
  arten text;
  v_von date;
  v_bis date;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Fuer eine Ablehnung ist eine Begruendung erforderlich.';
  end if;
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  select coalesce(r.request_group_id, r.id) into v_gruppe
  from leave_requests r
  where r.id = p_request_id and r.company_id = v_firma;

  if v_gruppe is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  -- Nur das Urlaubskonto darf nicht ins Minus. V-Tage dürfen es: wer alles
  -- verbraucht hat, bekommt trotzdem noch einen V-Tag.
  if p_decision = 'approved' then
    select string_agg(distinct x.konto, ' und ') into fehlend
    from (
      select 'Urlaubstage' as konto
      from leave_requests r
      join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
      where coalesce(r.request_group_id, r.id) = v_gruppe
        and r.status = 'pending'
        and r.kind = 'urlaub'
        and v.remaining_days < 0
    ) x;

    if fehlend is not null then
      raise exception 'Fuer diesen Antrag stehen nicht genuegend % zur Verfuegung.', fehlend;
    end if;
  end if;

  update leave_requests
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where coalesce(request_group_id, id) = v_gruppe
    and company_id = v_firma
    and status = 'pending';

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  select * into result from leave_requests where id = p_request_id;

  select min(start_date), max(end_date),
         string_agg(distinct leave_kind_label(kind), ' und ')
    into v_von, v_bis, arten
  from leave_requests
  where coalesce(request_group_id, id) = v_gruppe and company_id = v_firma;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(),
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    'leave_requests', result.id,
    jsonb_build_object(
      'reason', p_rejection_reason,
      'kind', result.kind,
      'gruppe', v_gruppe,
      'zeilen', v_anzahl,
      'von', v_von,
      'bis', v_bis
    )
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    arten || case when p_decision = 'approved' then ' genehmigt' else ' abgelehnt' end,
    case when v_von = v_bis
         then to_char(v_von, 'DD.MM.YYYY')
         else to_char(v_von, 'DD.MM.YYYY') || ' bis ' || to_char(v_bis, 'DD.MM.YYYY') end
    || case when p_decision = 'approved'
            then ': genehmigt.'
            else ': abgelehnt. ' || coalesce(p_rejection_reason, '') end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$function$;

create or replace function public.preview_leave_auto(p_start_date date, p_end_date date)
returns table(tag date, art text, grund text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees;
  d date;
  k leave_kind;
  warum text;
  jahr int;
  idx int;
  jahre int[] := '{}';
  ru numeric[] := '{}';
  rv numeric[] := '{}';
begin
  if me is null then return; end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then return; end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from g)::int
      from generate_series(p_start_date, p_end_date, '1 day') g
     order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce(
      (select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || coalesce(
      (select v_remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
  end loop;

  for d in select g::date from generate_series(p_start_date, p_end_date, '1 day') g loop
    continue when not is_planned_workday(me, d);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and d between r.start_date and r.end_date
    );

    idx := array_position(jahre, extract(year from d)::int);

    if not e.shift_worker then
      k := 'urlaub'; warum := 'kein Schichtsystem';
    elsif exists (select 1 from holidays h where h.date = d
                    and (h.company_id = e.company_id or h.company_id is null)) then
      k := 'urlaub'; warum := 'Feiertag';
    elsif extract(dow from d) = 0 then
      k := 'urlaub'; warum := 'Sonntag';
    elsif (select s.name from shifts s where s.id = effective_shift_id(me, d)) ilike 'Nacht%' then
      k := 'urlaub'; warum := 'Nachtschicht';
    else
      k := 'v_tag'; warum := 'kein Zuschlagstag';
    end if;

    if k = 'urlaub' and ru[idx] < 1 then
      -- Urlaub leer: V-Tag, notfalls ins Minus.
      k := 'v_tag';
      warum := case when rv[idx] >= 1 then 'Urlaub aufgebraucht' else 'Konten leer – V-Tag ins Minus' end;
    elsif k = 'v_tag' and rv[idx] < 1 and ru[idx] >= 1 then
      k := 'urlaub'; warum := 'V-Tage aufgebraucht';
    elsif k = 'v_tag' and rv[idx] < 1 then
      warum := 'Konten leer – V-Tag ins Minus';
    end if;

    if k = 'urlaub' then
      ru[idx] := ru[idx] - 1;
    else
      rv[idx] := rv[idx] - 1;
    end if;

    return query select d, k::text, warum;
  end loop;
end;
$function$;

create or replace function public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text default null::text)
returns table(urlaub_tage integer, v_tage integer, antraege integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees; tag date; art leave_kind; jahr int; idx int;
  jahre int[] := '{}'; ru numeric[] := '{}'; rv numeric[] := '{}';
  tage date[] := '{}'; arten leave_kind[] := '{}';
  i int; block_von date; block_bis date; block_art leave_kind;
  n_u int := 0; n_v int := 0; n_a int := 0;
  v_gruppe uuid := gen_random_uuid();
  v_erste uuid;
  v_arten text;
  v_tage_gesamt numeric;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from d)::int
      from generate_series(p_start_date, p_end_date, '1 day') d order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce((select remaining_days   from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || coalesce((select v_remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
  end loop;

  for tag in select d::date from generate_series(p_start_date, p_end_date, '1 day') d loop
    continue when not is_planned_workday(me, tag);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and tag between r.start_date and r.end_date);

    idx := array_position(jahre, extract(year from tag)::int);
    if not e.shift_worker then art := 'urlaub';
    elsif is_premium_day(me, tag) then art := 'urlaub';
    else art := 'v_tag'; end if;
    -- Urlaub leer: V-Tag (auch ins Minus). V leer, Urlaub da: Urlaub.
    if art = 'urlaub' and ru[idx] < 1 then art := 'v_tag'; end if;
    if art = 'v_tag'  and rv[idx] < 1 and ru[idx] >= 1 then art := 'urlaub'; end if;
    if art = 'urlaub' then
      ru[idx] := ru[idx] - 1; n_u := n_u + 1;
    else
      rv[idx] := rv[idx] - 1; n_v := n_v + 1;
    end if;
    tage  := tage  || tag;
    arten := arten || art;
  end loop;

  if array_length(tage, 1) is null then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  perform set_config('schichtplan.sammelantrag', 'an', true);

  block_von := tage[1]; block_bis := tage[1]; block_art := arten[1];

  for i in 2 .. array_length(tage, 1) loop
    if arten[i] = block_art and tage[i] = block_bis + 1
       and extract(year from tage[i]) = extract(year from block_bis) then
      block_bis := tage[i];
    else
      insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id)
      values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe);
      n_a := n_a + 1;
      block_von := tage[i]; block_bis := tage[i]; block_art := arten[i];
    end if;
  end loop;

  insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id)
  values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe);
  n_a := n_a + 1;

  perform set_config('schichtplan.sammelantrag', '', true);

  select (array_agg(id order by start_date))[1],
         string_agg(distinct leave_kind_label(kind), ' und '),
         sum(requested_days)
    into v_erste, v_arten, v_tage_gesamt
  from leave_requests where request_group_id = v_gruppe;

  perform notify_leave_submitted(
    e.company_id, me, v_erste,
    e.first_name || ' ' || e.last_name, e.rotation_team,
    v_arten, tage[1], tage[array_length(tage, 1)], v_tage_gesamt, p_reason
  );

  return query select n_u, n_v, n_a;
end;
$function$;

create or replace function public.suggest_leave_kind(p_employee_id uuid, p_date date)
returns table(kind text, grund text, u_rest numeric, v_rest numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  e employees; v_u numeric; v_v numeric;
  is_holiday boolean; is_sunday boolean; is_night boolean; sname text; lohnt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  select remaining_days, v_remaining_days into v_u, v_v
  from leave_balances_view where employee_id = p_employee_id and year = extract(year from p_date);
  v_u := coalesce(v_u,0); v_v := coalesce(v_v,0);

  if not is_planned_workday(p_employee_id, p_date) then
    return query select 'keins'::text, 'Freier Tag – kostet keinen Urlaub'::text, v_u, v_v;
    return;
  end if;

  select exists(select 1 from holidays h where h.date = p_date
    and (h.company_id = e.company_id or h.company_id is null)) into is_holiday;
  is_sunday := extract(dow from p_date) = 0;
  select name into sname from shifts where id = effective_shift_id(p_employee_id, p_date);
  is_night := coalesce(sname ilike 'Nacht%', false);

  if not e.shift_worker then
    if v_u > 0 then
      return query select 'urlaub'::text, 'Kein Schichtsystem – der Tag kostet Urlaub'::text, v_u, v_v;
    else
      return query select 'v_tag'::text, 'Urlaub aufgebraucht – V-Tag (darf ins Minus)'::text, v_u, v_v;
    end if;
    return;
  end if;

  lohnt := is_holiday or is_sunday or is_night;

  if lohnt and v_u > 0 then
    return query select 'urlaub'::text,
      case when is_holiday then 'Feiertag – mit Urlaub wird der Zuschlag mitbezahlt'
           when is_sunday  then 'Sonntag – mit Urlaub wird der Zuschlag mitbezahlt'
           else 'Nachtschicht – mit Urlaub wird der Zuschlag mitbezahlt' end, v_u, v_v;
  elsif lohnt and v_u <= 0 then
    return query select 'v_tag'::text,
      'Zuschlagstag, aber Urlaub aufgebraucht – V-Tag als Ersatz'::text, v_u, v_v;
  elsif not lohnt and v_v > 0 then
    return query select 'v_tag'::text,
      'Kein Zuschlagstag – V-Tag verwenden und Urlaub sparen'::text, v_u, v_v;
  elsif v_u > 0 then
    return query select 'urlaub'::text, 'V-Tage aufgebraucht – Urlaub wird verwendet'::text, v_u, v_v;
  else
    return query select 'v_tag'::text, 'Beide Konten aufgebraucht – V-Tag geht ins Minus'::text, v_u, v_v;
  end if;
end;
$function$;

-- 4: Sammelgenehmigung Antrag für Antrag -------------------------------------
create or replace function public.sammelgenehmigung_kandidaten(p_jahr integer default null)
returns table (antrag_id uuid, employee_id uuid, von date, bis date)
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
  select (array_agg(lr.id order by lr.start_date))[1],
         (array_agg(lr.employee_id order by lr.start_date))[1],
         min(lr.start_date),
         max(lr.end_date)
    from leave_requests lr
   where lr.company_id = v_firma
     and lr.status = 'pending'
   group by coalesce(lr.request_group_id, lr.id)
  having p_jahr is null
      or extract(year from min(lr.start_date))::int = p_jahr
      or extract(year from max(lr.end_date))::int = p_jahr
   order by min(lr.created_at), min(lr.start_date);
end;
$$;

revoke all on function public.sammelgenehmigung_kandidaten(integer) from public, anon;
grant execute on function public.sammelgenehmigung_kandidaten(integer) to authenticated;

-- Ein Antrag (samt Klammer): genau die Prüfung aus
-- approve_safe_leave_requests, dann genehmigen – oder mit Grund stehen lassen.
create or replace function public.sicher_genehmigen(p_request_id uuid)
returns table (ergebnis text, grund text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  r record;
  v_sicher boolean;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select coalesce(x.request_group_id, x.id) as gruppe
    into r
    from leave_requests x
   where x.id = p_request_id and x.company_id = v_firma and x.status = 'pending';
  if r.gruppe is null then
    return query select 'uebersprungen'::text, 'bereits entschieden'::text;
    return;
  end if;

  select (array_agg(lr.id order by lr.start_date))[1] as erste_id,
         (array_agg(lr.employee_id order by lr.start_date))[1] as employee_id,
         min(lr.start_date) as von,
         max(lr.end_date) as bis
    into r
    from leave_requests lr
   where coalesce(lr.request_group_id, lr.id) = r.gruppe
     and lr.status = 'pending';

  select not exists (
    select 1 from public.check_leave_staffing_impact(r.employee_id, r.von, r.bis) i
    where i.status <> 'ok'
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Besetzung wäre knapp'::text;
    return;
  end if;

  select not exists (
    select 1
    from generate_series(r.von, r.bis, interval '1 day') d
    cross join lateral (select effective_shift_id(r.employee_id, d::date) as sid) x
    cross join lateral public.qualifikation_besetzung(x.sid, d::date, null, true, r.employee_id) m
    join lateral public.qualifikation_besetzung(x.sid, d::date, r.employee_id, true, null) o
      on o.qualification_id = m.qualification_id
    where x.sid is not null
      and o.fehlt > m.fehlt
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Qualifikation fehlt sonst'::text;
    return;
  end if;

  begin
    perform public.decide_leave_request(r.erste_id, 'approved');
  exception when others then
    return query select 'uebersprungen'::text, sqlerrm;
    return;
  end;

  return query select 'genehmigt'::text, null::text;
end;
$$;

revoke all on function public.sicher_genehmigen(uuid) from public, anon;
grant execute on function public.sicher_genehmigen(uuid) to authenticated;

-- Wer hat meinen Antrag bearbeitet? (Name der prüfenden Person)
create or replace function public.my_leave_reviewers()
returns table (request_id uuid, reviewer_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, p.first_name || ' ' || p.last_name
    from leave_requests r
    join profiles p on p.id = r.reviewed_by
   where r.employee_id = auth_employee_id()
     and r.company_id = auth_company_id()
     and r.reviewed_by is not null;
$$;

revoke all on function public.my_leave_reviewers() from public, anon;
grant execute on function public.my_leave_reviewers() to authenticated;

revoke execute on function public.leave_requests_check_kontingent() from public, anon, authenticated;
