-- =====================================================================
-- 0152 – Gruppen (Familie, Freunde) mit eigenem Konto
--
-- Wer selbst den Kalender nutzt (Privatkonto oder Mitarbeiter), kann
-- einer Gruppe beitreten. In der Gruppe sieht jede Person, wann die
-- anderen arbeiten: nur Kürzel F/S/N/T (Arbeit), U (abwesend, ohne
-- Grund) und X (frei) – keine Termine, keine Namen von Schichten.
-- Höchstens 20 Personen je Gruppe und 10 Gruppen je Person.
-- =====================================================================

create table if not exists public.kalender_gruppen (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 40),
  erstellt_von uuid references auth.users (id) on delete set null,
  token_hash text unique,
  erstellt_am timestamptz not null default now()
);

create table if not exists public.kalender_gruppen_mitglieder (
  gruppe_id uuid not null references public.kalender_gruppen (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  beigetreten_am timestamptz not null default now(),
  primary key (gruppe_id, user_id)
);
create index if not exists kalender_gruppen_mitglieder_user on public.kalender_gruppen_mitglieder (user_id);

alter table public.kalender_gruppen enable row level security;
alter table public.kalender_gruppen_mitglieder enable row level security;
revoke all on public.kalender_gruppen from anon, authenticated;
revoke all on public.kalender_gruppen_mitglieder from anon, authenticated;

create or replace function public.kalender_gruppen_grenze()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if (select count(*) from kalender_gruppen_mitglieder where gruppe_id = new.gruppe_id) >= 20 then
    raise exception 'Diese Gruppe ist voll (höchstens 20 Personen).';
  end if;
  if (select count(*) from kalender_gruppen_mitglieder where user_id = new.user_id) >= 10 then
    raise exception 'Du bist schon in 10 Gruppen.';
  end if;
  return new;
end;
$$;
drop trigger if exists kalender_gruppen_grenze on public.kalender_gruppen_mitglieder;
create trigger kalender_gruppen_grenze before insert on public.kalender_gruppen_mitglieder
  for each row execute function public.kalender_gruppen_grenze();

create or replace function public.ist_gruppenmitglied(p_gruppe uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from kalender_gruppen_mitglieder where gruppe_id = p_gruppe and user_id = auth.uid())
$$;
revoke all on function public.ist_gruppenmitglied(uuid) from public, anon, authenticated;

create or replace function public.gruppe_zum_link(p_token text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select g.id from kalender_gruppen g
   where length(coalesce(p_token, '')) between 32 and 128
     and g.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;
revoke all on function public.gruppe_zum_link(text) from public, anon, authenticated;

create or replace function public.gruppe_erstellen(p_name text)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
  neu uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Bitte einen Namen für die Gruppe eingeben.';
  end if;
  insert into kalender_gruppen (name, erstellt_von, token_hash)
  values (left(btrim(p_name), 40), auth.uid(), encode(extensions.digest(schluessel, 'sha256'), 'hex'))
  returning id into neu;
  insert into kalender_gruppen_mitglieder (gruppe_id, user_id) values (neu, auth.uid());
  return jsonb_build_object('id', neu, 'schluessel', schluessel);
end;
$$;

create or replace function public.meine_gruppen()
returns table (id uuid, name text, mitglieder integer, von_mir boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select g.id, g.name,
           (select count(*)::int from kalender_gruppen_mitglieder x where x.gruppe_id = g.id),
           g.erstellt_von = auth.uid()
      from kalender_gruppen g
      join kalender_gruppen_mitglieder m on m.gruppe_id = g.id and m.user_id = auth.uid()
     order by m.beigetreten_am;
end;
$$;

/** Neuer Einladungslink – jedes Mitglied darf einladen; der alte gilt nicht mehr. */
create or replace function public.gruppe_link_neu(p_gruppe uuid)
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not ist_gruppenmitglied(p_gruppe) then
    raise exception 'Du bist nicht in dieser Gruppe.';
  end if;
  update kalender_gruppen set token_hash = encode(extensions.digest(schluessel, 'sha256'), 'hex') where id = p_gruppe;
  return schluessel;
end;
$$;

create or replace function public.gruppe_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  g uuid := gruppe_zum_link(p_token);
begin
  if g is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  return (select jsonb_build_object(
            'id', k.id,
            'name', k.name,
            'mitglieder', (select count(*) from kalender_gruppen_mitglieder x where x.gruppe_id = k.id),
            'dabei', ist_gruppenmitglied(k.id),
            'darf', kalender_nutzer())
            from kalender_gruppen k where k.id = g);
end;
$$;

create or replace function public.gruppe_beitreten(p_token text)
returns uuid language plpgsql volatile security definer set search_path to 'public' as $$
declare
  g uuid := gruppe_zum_link(p_token);
begin
  if g is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if not kalender_nutzer() then
    raise exception 'Zum Beitreten brauchst du einen eigenen Schichtkalender.';
  end if;
  insert into kalender_gruppen_mitglieder (gruppe_id, user_id) values (g, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;

/** Austreten – wer als Letzter geht, löscht die Gruppe. */
create or replace function public.gruppe_verlassen(p_gruppe uuid)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  delete from kalender_gruppen_mitglieder where gruppe_id = p_gruppe and user_id = auth.uid();
  if not exists (select 1 from kalender_gruppen_mitglieder where gruppe_id = p_gruppe) then
    delete from kalender_gruppen where id = p_gruppe;
  end if;
end;
$$;

/** Woche einer Gruppe: alle Mitglieder mit Kürzel je Tag (für die Gruppenansicht). */
create or replace function public.gruppe_tage(p_gruppe uuid, p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  m record;
  liste jsonb := '[]'::jsonb;
begin
  if not ist_gruppenmitglied(p_gruppe) then
    raise exception 'Du bist nicht in dieser Gruppe.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, x.user_id = auth.uid() as ich from kalender_gruppen_mitglieder x
     where x.gruppe_id = p_gruppe
     order by x.user_id = auth.uid() desc, x.beigetreten_am
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'ich', m.ich,
      'tage', kalender_codes(m.user_id, p_von, p_tage)));
  end loop;
  return liste;
end;
$$;

/** Alle anderen aus meinen Gruppen – für die Anzeige im eigenen Kalender. */
create or replace function public.meine_gruppen_tage(p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  m record;
  ich uuid := auth.uid();
  liste jsonb := '[]'::jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, jsonb_agg(x.gruppe_id) as gruppen
      from kalender_gruppen_mitglieder x
      join kalender_gruppen_mitglieder meine on meine.gruppe_id = x.gruppe_id and meine.user_id = ich
     where x.user_id <> ich
     group by x.user_id
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'gruppen', m.gruppen,
      'tage', kalender_codes(m.user_id, p_von, p_tage)));
  end loop;
  return liste;
end;
$$;

revoke all on function public.gruppe_erstellen(text) from public, anon;
revoke all on function public.meine_gruppen() from public, anon;
revoke all on function public.gruppe_link_neu(uuid) from public, anon;
revoke all on function public.gruppe_info(text) from public, anon;
revoke all on function public.gruppe_beitreten(text) from public, anon;
revoke all on function public.gruppe_verlassen(uuid) from public, anon;
revoke all on function public.gruppe_tage(uuid, date, integer) from public, anon;
revoke all on function public.meine_gruppen_tage(date, integer) from public, anon;
grant execute on function public.gruppe_erstellen(text) to authenticated;
grant execute on function public.meine_gruppen() to authenticated;
grant execute on function public.gruppe_link_neu(uuid) to authenticated;
grant execute on function public.gruppe_info(text) to authenticated;
grant execute on function public.gruppe_beitreten(text) to authenticated;
grant execute on function public.gruppe_verlassen(uuid) to authenticated;
grant execute on function public.gruppe_tage(uuid, date, integer) to authenticated;
grant execute on function public.meine_gruppen_tage(date, integer) to authenticated;
