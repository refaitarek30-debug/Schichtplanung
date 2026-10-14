-- Kalender-Abo (ICS) – zunächst nur für freigeschaltete Personen.
--
-- Freigabe für alle später mit einer einzigen Zeile:
--   update funktionen set fuer_alle = true where funktion = 'kalender_abo';
-- (vorher: Datenschutzerklärung ergänzen, Betriebsrat informieren)

create table if not exists funktionen (
  funktion text primary key,
  fuer_alle boolean not null default false
);
create table if not exists funktionen_zugang (
  funktion text not null references funktionen(funktion) on delete cascade,
  user_id uuid not null,
  primary key (funktion, user_id)
);
create table if not exists kalender_abo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  erstellt_am timestamptz not null default now(),
  beendet_am timestamptz,
  zuletzt_abgerufen timestamptz
);
create unique index if not exists kalender_abo_ein_aktiver on kalender_abo (user_id) where beendet_am is null;

alter table funktionen enable row level security;
alter table funktionen_zugang enable row level security;
alter table kalender_abo enable row level security;
revoke all on funktionen, funktionen_zugang, kalender_abo from anon, authenticated;

insert into funktionen (funktion, fuer_alle) values ('kalender_abo', false) on conflict do nothing;
insert into funktionen_zugang (funktion, user_id)
values ('kalender_abo', '2a78e4d4-b093-4f55-a485-fd12fe9c1f56') on conflict do nothing;

create or replace function funktion_frei(p_user uuid, p_name text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select f.fuer_alle from funktionen f where f.funktion = p_name), false)
      or exists (select 1 from funktionen_zugang z where z.funktion = p_name and z.user_id = p_user)
$$;

create or replace function hat_funktion(p_name text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and funktion_frei(auth.uid(), p_name)
$$;

create or replace function abo_erstellen() returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if ich is null or auth_employee_id() is null or not funktion_frei(ich, 'kalender_abo') then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_abo set beendet_am = now() where user_id = ich and beendet_am is null;
  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_abo (user_id, token_hash)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'));
  return schluessel;
end;
$$;

create or replace function abo_status()
returns table(aktiv boolean, erstellt_am timestamptz, zuletzt_abgerufen timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select true, a.erstellt_am, a.zuletzt_abgerufen
    from kalender_abo a
   where a.user_id = auth.uid() and a.beendet_am is null and funktion_frei(auth.uid(), 'kalender_abo')
$$;

create or replace function abo_beenden() returns void
language sql security definer set search_path to 'public' as $$
  update kalender_abo set beendet_am = now() where user_id = auth.uid() and beendet_am is null
$$;

create or replace function abo_plan(p_token text, p_von date, p_tage integer) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid;
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  ergebnis jsonb;
begin
  select a.user_id into inhaber
    from kalender_abo a
    join profiles p on p.id = a.user_id and p.active and p.employee_id is not null
   where a.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if inhaber is null or not funktion_frei(inhaber, 'kalender_abo') then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select p.company_id into firma from profiles p where p.id = inhaber;

  perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', inhaber::text, true);

  select coalesce(jsonb_agg(jsonb_build_object(
           'tag', g.day,
           'art', case
                    when g.absence_code is not null and g.absence_code = upper(g.absence_code) then
                      case when g.absence_code = 'FB' then 'schulung'
                           when g.absence_code in ('U', 'V', 'AF', 'SU', 'BU', 'G') then 'urlaub'
                           else 'abwesend' end
                    else 'schicht' end,
           'name', g.shift_name,
           'von', to_char(s.start_time, 'HH24:MI'),
           'bis', to_char(s.end_time, 'HH24:MI')) order by g.day), '[]'::jsonb)
    into ergebnis
    from shift_plan_grid(firma, p_von, p_tage) g
    left join lateral (select sh.start_time, sh.end_time from shifts sh
                        where sh.company_id = firma and sh.name = g.shift_name limit 1) s on true
   where g.is_me
     and (g.shift_name is not null
          or (g.absence_code is not null and g.absence_code = upper(g.absence_code)));

  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);

  update kalender_abo set zuletzt_abgerufen = now()
   where user_id = inhaber and beendet_am is null
     and (zuletzt_abgerufen is null or zuletzt_abgerufen < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

revoke all on function funktion_frei(uuid, text) from public, anon, authenticated;
revoke all on function hat_funktion(text), abo_erstellen(), abo_status(), abo_beenden() from public, anon;
grant execute on function hat_funktion(text), abo_erstellen(), abo_status(), abo_beenden() to authenticated;
revoke all on function abo_plan(text, date, integer) from public;
grant execute on function abo_plan(text, date, integer) to anon, authenticated;
