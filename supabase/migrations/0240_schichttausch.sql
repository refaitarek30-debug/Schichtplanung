-- =============================================================
-- 0240 · Schichttausch unter Kollegen
--
-- Ablauf (alles über Funktionen, keine direkten Tabellenrechte):
--  1. Eine Person bietet eine eigene Schicht an (tausch_anbieten).
--  2. Wer an dem Tag frei ist, übernimmt sie – auf Wunsch mit einem
--     Gegentag, an dem die anbietende Person dafür die Schicht der
--     übernehmenden Person macht (tausch_annehmen).
--  3. Die Leitung bestätigt mit einem Tipp (tausch_entscheiden). Erst dann
--     ändert sich der Plan.
--  Zurückziehen geht jederzeit vor der Entscheidung (tausch_zurueckziehen).
--  Namen erscheinen nur, wo team_sicht() es erlaubt (Migration 0237).
-- =============================================================

create table if not exists public.schicht_tausch (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  von_employee uuid not null references public.employees(id) on delete cascade,
  tag date not null,
  shift_id uuid references public.shifts(id) on delete set null,
  notiz text check (notiz is null or char_length(notiz) <= 200),
  status text not null default 'offen'
    check (status in ('offen', 'angefragt', 'genehmigt', 'abgelehnt', 'zurueckgezogen')),
  uebernehmer uuid references public.employees(id) on delete set null,
  gegen_tag date,
  gegen_shift_id uuid references public.shifts(id) on delete set null,
  angefragt_am timestamptz,
  entschieden_von uuid references auth.users(id) on delete set null,
  entschieden_am timestamptz,
  erstellt_am timestamptz not null default now()
);

create index if not exists schicht_tausch_firma_idx on public.schicht_tausch (company_id, status, tag);
create index if not exists schicht_tausch_von_idx on public.schicht_tausch (von_employee);
create index if not exists schicht_tausch_uebernehmer_idx on public.schicht_tausch (uebernehmer);
create unique index if not exists schicht_tausch_ein_angebot
  on public.schicht_tausch (von_employee, tag) where status in ('offen', 'angefragt');

alter table public.schicht_tausch enable row level security;
revoke all on public.schicht_tausch from anon, authenticated;

-- Frei an einem Tag: keine Schicht und nicht abwesend (Urlaub, krank …).
create or replace function public.tausch_frei(p_employee uuid, p_tag date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.effective_shift_id(p_employee, p_tag) is null
     and not exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = p_employee);
$function$;

-- Arbeitet an dem Tag und ist nicht abwesend.
create or replace function public.tausch_arbeitet(p_employee uuid, p_tag date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.effective_shift_id(p_employee, p_tag) is not null
     and not exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = p_employee);
$function$;

revoke execute on function public.tausch_frei(uuid, date) from public, anon, authenticated;
revoke execute on function public.tausch_arbeitet(uuid, date) from public, anon, authenticated;

-- Glocke an die Leitung (Administration und Schichtleitung der Gruppe), ohne die Beteiligten.
create or replace function public.tausch_leitung_benachrichtigen(p_tausch uuid, p_titel text, p_text text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.schicht_tausch;
  gruppe rotation_team;
begin
  select * into t from public.schicht_tausch where id = p_tausch;
  select e.rotation_team into gruppe from public.employees e where e.id = t.von_employee;
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select t.company_id, p.employee_id, 'tausch_angefragt', p_titel, p_text, 'schicht_tausch', t.id
    from public.profiles p
    join public.employees pe on pe.id = p.employee_id
   where p.company_id = t.company_id
     and p.active
     and p.employee_id is distinct from t.von_employee
     and p.employee_id is distinct from t.uebernehmer
     and (p.role = 'admin'
          or (p.role = 'shift_leader' and (gruppe is null or pe.rotation_team is null or pe.rotation_team = gruppe)));
end;
$function$;

revoke execute on function public.tausch_leitung_benachrichtigen(uuid, text, text) from public, anon, authenticated;

-- 1. Eigene Schicht anbieten.
create or replace function public.tausch_anbieten(p_tag date, p_notiz text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  schicht uuid;
  neu uuid;
begin
  if me is null or firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  if p_tag < current_date then
    raise exception 'Dieser Tag ist schon vorbei.';
  end if;
  if p_tag > current_date + 180 then
    raise exception 'Tauschen geht höchstens ein halbes Jahr im Voraus.';
  end if;
  schicht := public.effective_shift_id(me, p_tag);
  if schicht is null then
    raise exception 'An diesem Tag hast du keine Schicht.';
  end if;
  if exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = me) then
    raise exception 'An diesem Tag bist du schon abwesend (z. B. Urlaub).';
  end if;
  if exists (select 1 from public.schicht_tausch t where t.von_employee = me and t.tag = p_tag and t.status in ('offen', 'angefragt')) then
    raise exception 'Diesen Tag hast du schon angeboten.';
  end if;
  insert into public.schicht_tausch (company_id, von_employee, tag, shift_id, notiz)
  values (firma, me, p_tag, schicht, nullif(btrim(coalesce(p_notiz, '')), ''))
  returning id into neu;
  return neu;
end;
$function$;

-- Liste für die App: offene Angebote, eigene Angebote und Übernahmen,
-- für die Leitung zusätzlich alles, was auf ihre Entscheidung wartet.
create or replace function public.tausch_liste()
returns table(
  id uuid, tag date, schicht text, von_name text, von_ich boolean, status text, notiz text,
  uebernehmer_name text, uebernehmer_ich boolean, gegen_tag date, gegen_schicht text,
  passt boolean, grund text, erstellt_am timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
begin
  if firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  return query
  select t.id, t.tag, s.name,
         case when public.team_sicht(t.von_employee) then v.first_name || ' ' || v.last_name else 'Ohne Namen' end,
         t.von_employee = me,
         t.status, t.notiz,
         case when t.uebernehmer is null then null
              when public.team_sicht(t.uebernehmer) then u.first_name || ' ' || u.last_name
              else 'Ohne Namen' end,
         t.uebernehmer = me,
         t.gegen_tag, gs.name,
         case when me is null or t.von_employee = me or t.status <> 'offen' then null
              else public.tausch_frei(me, t.tag) end,
         case when me is null or t.von_employee = me or t.status <> 'offen' then null
              when public.tausch_frei(me, t.tag) then 'Du hast an dem Tag frei'
              when public.effective_shift_id(me, t.tag) is not null then 'Du arbeitest an dem Tag schon'
              else 'Du bist an dem Tag abwesend' end,
         t.erstellt_am
    from public.schicht_tausch t
    join public.employees v on v.id = t.von_employee
    left join public.employees u on u.id = t.uebernehmer
    left join public.shifts s on s.id = t.shift_id
    left join public.shifts gs on gs.id = t.gegen_shift_id
   where t.company_id = firma
     and (
       (t.status = 'offen' and t.tag >= current_date)
       or (t.status = 'angefragt' and (fuehrung or t.von_employee = me or t.uebernehmer = me))
       or ((t.von_employee = me or t.uebernehmer = me) and t.tag >= current_date - 14)
       or (fuehrung and t.status in ('genehmigt', 'abgelehnt') and t.entschieden_am > now() - interval '14 days')
     )
   order by case t.status when 'angefragt' then 0 when 'offen' then 1 else 2 end, t.tag;
end;
$function$;

-- 2. Übernehmen (optional mit Gegentag).
create or replace function public.tausch_annehmen(p_id uuid, p_gegen_tag date default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  t public.schicht_tausch;
  ich text;
  gegen_schicht uuid;
begin
  if me is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  select * into t from public.schicht_tausch where id = p_id and company_id = firma for update;
  if t.id is null then
    raise exception 'Dieses Angebot gibt es nicht mehr.';
  end if;
  if t.status <> 'offen' then
    raise exception 'Jemand anderes war schneller – das Angebot ist schon vergeben.';
  end if;
  if t.von_employee = me then
    raise exception 'Das ist dein eigenes Angebot.';
  end if;
  if t.tag < current_date then
    raise exception 'Dieser Tag ist schon vorbei.';
  end if;
  if not public.tausch_frei(me, t.tag) then
    raise exception 'Du kannst die Schicht nur übernehmen, wenn du an dem Tag frei hast.';
  end if;
  if p_gegen_tag is not null then
    if p_gegen_tag < current_date then
      raise exception 'Der Gegentag ist schon vorbei.';
    end if;
    if not public.tausch_arbeitet(me, p_gegen_tag) then
      raise exception 'Am Gegentag hast du selbst keine Schicht zum Abgeben.';
    end if;
    if not public.tausch_frei(t.von_employee, p_gegen_tag) then
      raise exception 'Am Gegentag hat die andere Person keine Zeit.';
    end if;
    gegen_schicht := public.effective_shift_id(me, p_gegen_tag);
  end if;

  update public.schicht_tausch
     set status = 'angefragt', uebernehmer = me, gegen_tag = p_gegen_tag,
         gegen_shift_id = gegen_schicht, angefragt_am = now()
   where id = p_id;

  select e.first_name || ' ' || e.last_name into ich from public.employees e where e.id = me;
  -- An die anbietende Person: wer übernehmen möchte (die Person hat sich selbst gemeldet).
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (firma, t.von_employee, 'tausch_angefragt', 'Deine Schicht wird übernommen',
          ich || ' möchte deine Schicht am ' || to_char(t.tag, 'DD.MM.') || ' übernehmen'
            || case when p_gegen_tag is not null then ' und dir dafür den ' || to_char(p_gegen_tag, 'DD.MM.') || ' geben' else '' end
            || '. Die Leitung bestätigt noch.',
          'schicht_tausch', p_id);
  perform public.tausch_leitung_benachrichtigen(p_id, 'Schichttausch bestätigen',
    ich || ' übernimmt am ' || to_char(t.tag, 'DD.MM.') || ' eine Schicht'
      || case when p_gegen_tag is not null then ' (Gegentag ' || to_char(p_gegen_tag, 'DD.MM.') || ')' else '' end || '.');
end;
$function$;

-- 3. Leitung entscheidet. Erst hier ändert sich der Plan.
create or replace function public.tausch_entscheiden(p_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  t public.schicht_tausch;
  titel text;
  text_ text;
begin
  if not is_leadership() then
    raise exception 'Das darf nur die Leitung.';
  end if;
  select * into t from public.schicht_tausch where id = p_id and company_id = firma for update;
  if t.id is null or t.status <> 'angefragt' then
    raise exception 'Dieser Tausch wartet nicht mehr auf eine Entscheidung.';
  end if;

  if p_ok then
    -- Noch einmal prüfen: Hat sich der Plan seitdem geändert?
    if public.effective_shift_id(t.von_employee, t.tag) is distinct from t.shift_id then
      raise exception 'Der Plan hat sich am % geändert – der Tausch passt nicht mehr.', to_char(t.tag, 'DD.MM.');
    end if;
    if not public.tausch_frei(t.uebernehmer, t.tag) then
      raise exception 'Die übernehmende Person ist am % nicht mehr frei.', to_char(t.tag, 'DD.MM.');
    end if;
    if t.gegen_tag is not null then
      if public.effective_shift_id(t.uebernehmer, t.gegen_tag) is distinct from t.gegen_shift_id
         or not public.tausch_frei(t.von_employee, t.gegen_tag) then
        raise exception 'Der Gegentag % passt nicht mehr.', to_char(t.gegen_tag, 'DD.MM.');
      end if;
    end if;

    delete from public.shift_assignments
     where (employee_id in (t.von_employee, t.uebernehmer) and date = t.tag)
        or (t.gegen_tag is not null and employee_id in (t.von_employee, t.uebernehmer) and date = t.gegen_tag);
    insert into public.shift_assignments (company_id, employee_id, shift_id, date) values
      (firma, t.von_employee, null, t.tag),
      (firma, t.uebernehmer, t.shift_id, t.tag);
    if t.gegen_tag is not null then
      insert into public.shift_assignments (company_id, employee_id, shift_id, date) values
        (firma, t.uebernehmer, null, t.gegen_tag),
        (firma, t.von_employee, t.gegen_shift_id, t.gegen_tag);
    end if;
  end if;

  update public.schicht_tausch
     set status = case when p_ok then 'genehmigt' else 'abgelehnt' end,
         entschieden_von = auth.uid(), entschieden_am = now()
   where id = p_id;

  titel := case when p_ok then 'Schichttausch bestätigt' else 'Schichttausch abgelehnt' end;
  text_ := 'Tausch am ' || to_char(t.tag, 'DD.MM.')
    || case when t.gegen_tag is not null then ' (Gegentag ' || to_char(t.gegen_tag, 'DD.MM.') || ')' else '' end
    || case when p_ok then ' ist bestätigt. Der Plan ist geändert.' else ' wurde von der Leitung abgelehnt.' end;
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (firma, t.von_employee, 'tausch_entschieden', titel, text_, 'schicht_tausch', p_id),
         (firma, t.uebernehmer, 'tausch_entschieden', titel, text_, 'schicht_tausch', p_id);

  perform public.write_audit(firma, case when p_ok then 'tausch.genehmigt' else 'tausch.abgelehnt' end,
                             'schicht_tausch', p_id, jsonb_build_object('tag', t.tag, 'gegen_tag', t.gegen_tag));
end;
$function$;

-- Zurückziehen: wer angeboten hat, nimmt das Angebot zurück; wer übernehmen
-- wollte, gibt es wieder frei. Nach der Entscheidung geht das nicht mehr.
create or replace function public.tausch_zurueckziehen(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  t public.schicht_tausch;
begin
  select * into t from public.schicht_tausch where id = p_id and company_id = auth_company_id() for update;
  if t.id is null or t.status not in ('offen', 'angefragt') then
    raise exception 'Das geht nicht mehr – darüber wurde schon entschieden.';
  end if;
  if t.von_employee = me then
    update public.schicht_tausch set status = 'zurueckgezogen' where id = p_id;
  elsif t.uebernehmer = me then
    update public.schicht_tausch
       set status = 'offen', uebernehmer = null, gegen_tag = null, gegen_shift_id = null, angefragt_am = null
     where id = p_id;
  else
    raise exception 'Das ist nicht dein Tausch.';
  end if;
end;
$function$;

revoke execute on function public.tausch_anbieten(date, text) from public, anon;
revoke execute on function public.tausch_liste() from public, anon;
revoke execute on function public.tausch_annehmen(uuid, date) from public, anon;
revoke execute on function public.tausch_entscheiden(uuid, boolean) from public, anon;
revoke execute on function public.tausch_zurueckziehen(uuid) from public, anon;
grant execute on function public.tausch_anbieten(date, text) to authenticated;
grant execute on function public.tausch_liste() to authenticated;
grant execute on function public.tausch_annehmen(uuid, date) to authenticated;
grant execute on function public.tausch_entscheiden(uuid, boolean) to authenticated;
grant execute on function public.tausch_zurueckziehen(uuid) to authenticated;

-- Push aus der Glocke: Tausch führt in den Tausch-Reiter.
create or replace function public.push_aus_benachrichtigung()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  art text := case
    when new.type = 'replacement_requested' then 'einspringen'
    when new.type = 'fehlzeit' then 'plan'
    when new.type like 'tausch_%' then 'plan'
    else 'antraege' end;
  ziel text := case
    when new.type = 'leave_submitted' then '/urlaubsantraege'
    when new.type like 'leave_%' then '/urlaub'
    when new.type like 'tausch_%' then '/schichtplan/tausch'
    else '/start' end;
begin
  begin
    perform push_einreihen(konto_zu_mitarbeiter(new.employee_id), art, new.title, coalesce(new.body, ''), ziel,
                           'glocke-' || new.id::text, null);
  exception when others then
    null;
  end;
  return new;
end;
$function$;

revoke execute on function public.push_aus_benachrichtigung() from public, anon, authenticated;
