-- Kalender: Partner einladen
--
-- Eine Person (Inhaber) lädt per Link ihren Partner ein. Der Partner sieht
-- über den Link den Schichtplan des Inhabers – nur Früh/Spät/Nacht/Frei,
-- keine Abwesenheitsgründe, keine Kollegen – und trägt seine eigenen
-- Arbeitstage ein. Der Inhaber sieht diese Tage in seinem Kalender.
--
-- Kein eigenes Konto für den Partner: der Link IST der Zugang. Gespeichert
-- wird nur der SHA-256 des Schlüssels, der Link selbst steht nirgends in
-- der Datenbank. Der Inhaber kann ihn jederzeit beenden oder neu erzeugen
-- (dann gilt der alte nicht mehr).
--
-- Beide Tabellen sind ohne Policies und ohne Rechte für anon/authenticated
-- – Zugriff ausschließlich über die Funktionen unten. Niemand außer dem
-- Inhaber (und dem Partner über den Link) sieht die Partnertage, auch die
-- Firma nicht.

create table if not exists public.kalender_partner (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  erstellt_am timestamptz not null default now(),
  beendet_am timestamptz,
  zuletzt_genutzt timestamptz
);

create unique index if not exists kalender_partner_ein_aktiver
  on public.kalender_partner (owner_id) where beendet_am is null;

create table if not exists public.kalender_partner_tage (
  owner_id uuid not null references auth.users (id) on delete cascade,
  tag date not null,
  schicht text not null check (schicht in ('F', 'S', 'N', 'T', 'X')),
  geaendert_am timestamptz not null default now(),
  primary key (owner_id, tag)
);

alter table public.kalender_partner enable row level security;
alter table public.kalender_partner_tage enable row level security;
revoke all on public.kalender_partner from anon, authenticated;
revoke all on public.kalender_partner_tage from anon, authenticated;

-- ---------------------------------------------------------------------
-- Inhaber (angemeldet)
-- ---------------------------------------------------------------------

/** Neuen Link erzeugen. Ein bestehender wird dabei beendet. */
create or replace function public.partner_link_erstellen()
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if ich is null or auth_employee_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  update kalender_partner set beendet_am = now()
   where owner_id = ich and beendet_am is null;

  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_partner (owner_id, token_hash)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'));
  return schluessel;
end;
$$;

/** Ist ein Link aktiv – und wann wurde er zuletzt benutzt? */
create or replace function public.partner_link_status()
returns table (aktiv boolean, erstellt_am timestamptz, zuletzt_genutzt timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select true, k.erstellt_am, k.zuletzt_genutzt
    from kalender_partner k
   where k.owner_id = auth.uid() and k.beendet_am is null
$$;

/** Zugang beenden – der Link gilt danach nicht mehr. */
create or replace function public.partner_link_beenden()
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  update kalender_partner set beendet_am = now()
   where owner_id = auth.uid() and beendet_am is null
$$;

/** Partnertage für den eigenen Kalender. */
create or replace function public.meine_partner_tage(p_von date, p_bis date)
returns table (tag date, schicht text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_bis < p_von or p_bis - p_von > 120 then
    raise exception 'Zeitraum zu groß.';
  end if;
  return query
    select t.tag, t.schicht from kalender_partner_tage t
     where t.owner_id = auth.uid() and t.tag between p_von and p_bis
     order by t.tag;
end;
$$;

/** Interne Hilfe: ab p_von für p_anzahl Tage setzen (null = entfernen). */
create or replace function public.partner_tage_schreiben(
  p_owner uuid, p_von date, p_anzahl integer, p_schicht text
)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  if p_anzahl < 1 or p_anzahl > 31 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if p_schicht is not null and p_schicht not in ('F', 'S', 'N', 'T', 'X') then
    raise exception 'Unbekannte Schicht.';
  end if;
  if p_schicht is null then
    delete from kalender_partner_tage
     where owner_id = p_owner and tag between p_von and p_von + (p_anzahl - 1);
  else
    insert into kalender_partner_tage (owner_id, tag, schicht)
    select p_owner, d::date, p_schicht
      from generate_series(p_von, p_von + (p_anzahl - 1), interval '1 day') d
    on conflict (owner_id, tag)
      do update set schicht = excluded.schicht, geaendert_am = now();
  end if;
end;
$$;
revoke all on function public.partner_tage_schreiben(uuid, date, integer, text) from public, anon, authenticated;

/** Inhaber trägt Partnertage selbst ein. */
create or replace function public.meine_partner_tage_setzen(
  p_von date, p_anzahl integer, p_schicht text
)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or auth_employee_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  perform partner_tage_schreiben(auth.uid(), p_von, p_anzahl, p_schicht);
end;
$$;

-- ---------------------------------------------------------------------
-- Partner (ohne Konto, nur mit dem Link)
-- ---------------------------------------------------------------------

/** Inhaber zum Schlüssel – nur wenn Link aktiv und Inhaber noch aktiv. */
create or replace function public.partner_inhaber(p_token text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select k.owner_id
    from kalender_partner k
    join profiles p on p.id = k.owner_id and p.active and p.employee_id is not null
   where k.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;
revoke all on function public.partner_inhaber(text) from public, anon, authenticated;

/**
 * Kalender für den Partner: Vorname des Inhabers und je Tag
 * [Tag, Schicht des Inhabers, Schicht des Partners].
 *
 * Die Schicht des Inhabers kommt aus derselben Rechnung wie im Schichtplan
 * (`shift_plan_grid`). Die Funktion fragt nach „mir“ – deshalb wird für
 * genau diesen Aufruf die Kennung des Inhabers gesetzt und danach sofort
 * wieder zurückgestellt. Abwesenheiten erscheinen als „X“ (frei): der
 * Partner erfährt nicht, ob Urlaub, Krankheit oder etwas anderes.
 */
create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid := partner_inhaber(p_token);
  firma uuid;
  vorname text;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  eigene jsonb;
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select p.company_id, p.first_name into firma, vorname from profiles p where p.id = inhaber;

  perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', inhaber::text, true);

  select jsonb_object_agg(
           g.day::text,
           case
             when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'X'
             when g.shift_code in ('F', 'S', 'N') then g.shift_code
             when g.shift_name is not null then 'T'
             else 'X'
           end)
    into eigene
    from shift_plan_grid(firma, p_von, p_tage) g
   where g.is_me;

  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);

  select jsonb_build_object(
           'name', vorname,
           'tage', coalesce(jsonb_agg(jsonb_build_array(d::date, eigene ->> (d::date)::text, t.schicht) order by d), '[]'::jsonb))
    into ergebnis
    from generate_series(p_von, p_von + (p_tage - 1), interval '1 day') d
    left join kalender_partner_tage t on t.owner_id = inhaber and t.tag = d::date;

  update kalender_partner set zuletzt_genutzt = now()
   where owner_id = inhaber and beendet_am is null
     and (zuletzt_genutzt is null or zuletzt_genutzt < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

/** Partner trägt seine Tage ein. */
create or replace function public.partner_tage_setzen(
  p_token text, p_von date, p_anzahl integer, p_schicht text
)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid := partner_inhaber(p_token);
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
  perform partner_tage_schreiben(inhaber, p_von, p_anzahl, p_schicht);
end;
$$;

revoke all on function public.partner_link_erstellen() from public, anon;
revoke all on function public.partner_link_status() from public, anon;
revoke all on function public.partner_link_beenden() from public, anon;
revoke all on function public.meine_partner_tage(date, date) from public, anon;
revoke all on function public.meine_partner_tage_setzen(date, integer, text) from public, anon;
grant execute on function public.partner_link_erstellen() to authenticated;
grant execute on function public.partner_link_status() to authenticated;
grant execute on function public.partner_link_beenden() to authenticated;
grant execute on function public.meine_partner_tage(date, date) to authenticated;
grant execute on function public.meine_partner_tage_setzen(date, integer, text) to authenticated;

revoke all on function public.partner_kalender(text, date, integer) from public;
revoke all on function public.partner_tage_setzen(text, date, integer, text) from public;
grant execute on function public.partner_kalender(text, date, integer) to anon, authenticated;
grant execute on function public.partner_tage_setzen(text, date, integer, text) to anon, authenticated;
