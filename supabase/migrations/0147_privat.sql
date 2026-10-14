-- =====================================================================
-- Privatbereich: Schichtkalender für Einzelpersonen, ohne Firma.
--
-- Wer sich unter /privat/registrieren anmeldet, bekommt KEIN Profil
-- (der Trigger handle_new_user legt nur bei Einladungen eines an) und
-- sieht damit keine Firmendaten – alle bestehenden Regeln greifen über
-- auth_company_id(), und das ist für diese Konten leer.
--
-- Stattdessen: ein Privatkonto mit eigenen Schichtarten und Tagen. Alles
-- gehört genau einer Person (RLS auf user_id = auth.uid()).
--
-- Partner-Link, Termine und Kalender-Abo funktionieren auch für
-- Privatkonten: Die Prüfungen „hat ein Firmenprofil“ werden um „oder ist
-- ein Privatkonto“ ergänzt.
-- =====================================================================

create table if not exists public.privat_konten (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  bundesland text not null default 'NW'
    check (bundesland in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH')),
  feiertage_zeigen boolean not null default true,
  wochenstunden numeric(4,1) check (wochenstunden is null or (wochenstunden >= 0 and wochenstunden <= 80)),
  datenschutz_version text,
  erstellt_am timestamptz not null default now()
);

create table if not exists public.privat_schichtarten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.privat_konten (user_id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  kuerzel text not null check (length(btrim(kuerzel)) between 1 and 3),
  farbe text not null check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  art text not null default 'arbeit' check (art in ('arbeit', 'frei', 'urlaub', 'krank')),
  beginn time,
  ende time,
  stunden numeric(4,2) not null default 0 check (stunden >= 0 and stunden <= 24),
  reihenfolge integer not null default 0,
  erstellt_am timestamptz not null default now(),
  unique (user_id, id)
);
create index if not exists privat_schichtarten_user on public.privat_schichtarten (user_id);

create table if not exists public.privat_tage (
  user_id uuid not null references public.privat_konten (user_id) on delete cascade,
  tag date not null,
  schichtart_id uuid not null,
  primary key (user_id, tag),
  -- Die Schichtart muss derselben Person gehören.
  foreign key (user_id, schichtart_id)
    references public.privat_schichtarten (user_id, id) on delete cascade
);
create index if not exists privat_tage_art on public.privat_tage (schichtart_id);

alter table public.privat_konten enable row level security;
alter table public.privat_schichtarten enable row level security;
alter table public.privat_tage enable row level security;

drop policy if exists privat_konten_eigen on public.privat_konten;
create policy privat_konten_eigen on public.privat_konten
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists privat_schichtarten_eigen on public.privat_schichtarten;
create policy privat_schichtarten_eigen on public.privat_schichtarten
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists privat_tage_eigen on public.privat_tage;
create policy privat_tage_eigen on public.privat_tage
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.privat_konten, public.privat_schichtarten, public.privat_tage from anon, authenticated;
-- Konto: nur lesen und die eigenen Einstellungen ändern. Angelegt wird es
-- vom Server (privat_konto_anlegen), gelöscht mit dem Zugang.
grant select on public.privat_konten to authenticated;
grant update (name, bundesland, feiertage_zeigen, wochenstunden) on public.privat_konten to authenticated;
grant select, insert, update, delete on public.privat_schichtarten, public.privat_tage to authenticated;

-- Höchstens 30 Schichtarten je Person.
create or replace function public.privat_schichtarten_grenze()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (select count(*) from privat_schichtarten where user_id = new.user_id) >= 30 then
    raise exception 'Höchstens 30 Schichtarten.';
  end if;
  return new;
end;
$$;
drop trigger if exists privat_schichtarten_grenze on public.privat_schichtarten;
create trigger privat_schichtarten_grenze before insert on public.privat_schichtarten
  for each row execute function public.privat_schichtarten_grenze();

-- ---------------------------------------------------------------------
-- Anlegen (nur Server mit Dienstschlüssel) – mit sinnvollen Vorlagen.
-- ---------------------------------------------------------------------
create or replace function public.privat_konto_anlegen(p_user uuid, p_name text, p_version text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from profiles where id = p_user) then
    raise exception 'Dieses Konto gehört bereits zu einem Unternehmen.';
  end if;
  insert into privat_konten (user_id, name, datenschutz_version)
  values (p_user, btrim(p_name), p_version)
  on conflict (user_id) do nothing;
  if not exists (select 1 from privat_schichtarten where user_id = p_user) then
    insert into privat_schichtarten (user_id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge) values
      (p_user, 'Früh',   'F', '#F5A524', 'arbeit', '06:00', '14:00', 8, 1),
      (p_user, 'Spät',   'S', '#22A06B', 'arbeit', '14:00', '22:00', 8, 2),
      (p_user, 'Nacht',  'N', '#2F6FDE', 'arbeit', '22:00', '06:00', 8, 3),
      (p_user, 'Frei',   'X', '#E5484D', 'frei',   null,    null,    0, 4),
      (p_user, 'Urlaub', 'U', '#9B59D0', 'urlaub', null,    null,    8, 5),
      (p_user, 'Krank',  'K', '#F76B15', 'krank',  null,    null,    8, 6);
  end if;
end;
$$;
revoke all on function public.privat_konto_anlegen(uuid, text, text) from public, anon, authenticated;
grant execute on function public.privat_konto_anlegen(uuid, text, text) to service_role;

create or replace function public.ist_privatkonto(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_user is not null and exists (select 1 from privat_konten where user_id = p_user)
$$;
revoke all on function public.ist_privatkonto(uuid) from public, anon, authenticated;

/** Darf den eigenen Kalender (Termine, Partner, Abo) nutzen? */
create or replace function public.kalender_nutzer()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and (auth_employee_id() is not null or ist_privatkonto(auth.uid()))
$$;
revoke all on function public.kalender_nutzer() from public, anon;
grant execute on function public.kalender_nutzer() to authenticated;

-- ---------------------------------------------------------------------
-- Rotation eintragen: Muster ab Startdatum wiederholen. NULL im Muster =
-- an diesem Tag nichts eintragen (mit p_ueberschreiben: leeren).
-- ---------------------------------------------------------------------
create or replace function public.privat_rotation_anwenden(
  p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean
)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  laenge integer := coalesce(array_length(p_muster, 1), 0);
  anzahl integer;
begin
  if not ist_privatkonto(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if laenge < 1 or laenge > 56 then
    raise exception 'Das Muster muss 1 bis 56 Tage lang sein.';
  end if;
  if p_start is null or p_bis is null or p_bis < p_start or p_bis - p_start > 1100 then
    raise exception 'Bitte einen Zeitraum von höchstens drei Jahren wählen.';
  end if;
  if exists (select 1 from unnest(p_muster) m
              where m is not null
                and not exists (select 1 from privat_schichtarten s where s.id = m and s.user_id = ich)) then
    raise exception 'Unbekannte Schichtart im Muster.';
  end if;

  if p_ueberschreiben then
    delete from privat_tage
     where user_id = ich and tag between p_start and p_bis
       and p_muster[((tag - p_start) % laenge) + 1] is null;
  end if;

  insert into privat_tage (user_id, tag, schichtart_id)
  select ich, d::date, p_muster[(((d::date) - p_start) % laenge) + 1]
    from generate_series(p_start, p_bis, interval '1 day') d
   where p_muster[(((d::date) - p_start) % laenge) + 1] is not null
  on conflict (user_id, tag) do update
     set schichtart_id = excluded.schichtart_id
   where p_ueberschreiben;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;
revoke all on function public.privat_rotation_anwenden(date, date, uuid[], boolean) from public, anon;
grant execute on function public.privat_rotation_anwenden(date, date, uuid[], boolean) to authenticated;

/** Gesetzliche Feiertage im Bundesland des eigenen Kontos. */
create or replace function public.privat_feiertage(p_jahr integer)
returns table (tag date, name text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  land text;
begin
  select k.bundesland into land from privat_konten k where k.user_id = auth.uid();
  if land is null or p_jahr < 2000 or p_jahr > 2100 then
    return;
  end if;
  return query select h.tag, h.bezeichnung from german_holidays(p_jahr, land) h order by h.tag;
end;
$$;
revoke all on function public.privat_feiertage(integer) from public, anon;
grant execute on function public.privat_feiertage(integer) to authenticated;

/** Kürzel für die Partneransicht (F, S, N, T, U, X). */
create or replace function public.privat_code(p_art text, p_beginn time)
returns text language sql immutable as $$
  select case
           when p_art in ('urlaub', 'krank') then 'U'
           when p_art = 'frei' then 'X'
           when p_beginn is null then 'T'
           when extract(hour from p_beginn) between 4 and 10 then 'F'
           when extract(hour from p_beginn) between 11 and 18 then 'S'
           else 'N'
         end
$$;

-- =====================================================================
-- Bestehende Kalenderfunktionen: Privatkonten zulassen.
-- Für Firmenkonten ändert sich nichts – die Bedingung wird nur um
-- „oder Privatkonto“ ergänzt.
-- =====================================================================

create or replace function public.partner_einladen(p_termine_teilen boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_partner set beendet_am = now()
   where owner_id = ich and beendet_am is null;
  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_partner (owner_id, token_hash, termine_teilen)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'), coalesce(p_termine_teilen, false));
  return schluessel;
end;
$$;

create or replace function public.meine_partner_tage_setzen(p_von date, p_anzahl integer, p_schicht text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  perform partner_tage_schreiben(auth.uid(), p_von, p_anzahl, p_schicht);
end;
$$;

create or replace function public.termin_speichern(
  p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time, p_ende time,
  p_wiederholung text, p_notiz text, p_ort text
)
returns uuid language plpgsql security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
end;
$$;

create or replace function public.partner_inhaber(p_token text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select k.owner_id
    from kalender_partner k
   where k.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (exists (select 1 from profiles p where p.id = k.owner_id and p.active and p.employee_id is not null)
          or ist_privatkonto(k.owner_id))
$$;

create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := partner_inhaber(p_token);
  teilen boolean;
  firma uuid;
  vorname text;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  eigene jsonb;
  ergebnis jsonb;
  termine jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select k.termine_teilen into teilen from kalender_partner k where k.owner_id = inhaber and k.beendet_am is null;

  if ist_privatkonto(inhaber) then
    select split_part(btrim(k.name), ' ', 1) into vorname from privat_konten k where k.user_id = inhaber;
    select jsonb_object_agg(t.tag::text, privat_code(s.art, s.beginn))
      into eigene
      from privat_tage t
      join privat_schichtarten s on s.id = t.schichtart_id
     where t.user_id = inhaber and t.tag between p_von and p_von + (p_tage - 1);
  else
    select p.company_id, p.first_name into firma, vorname from profiles p where p.id = inhaber;

    perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', inhaber::text, true);

    select jsonb_object_agg(
             g.day::text,
             case
               when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
               when g.shift_code in ('F', 'S', 'N') then g.shift_code
               when g.shift_name is not null then 'T'
               else 'X'
             end)
      into eigene
      from shift_plan_grid(firma, p_von, p_tage) g
     where g.is_me;

    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'vonPartner', t.von_partner, 'datum', t.datum, 'titel', t.titel,
           'ganztaegig', t.ganztaegig, 'von', coalesce(to_char(t.beginn, 'HH24:MI'), ''),
           'bis', coalesce(to_char(t.ende, 'HH24:MI'), ''), 'wiederholung', t.wiederholung,
           'notiz', t.notiz, 'ort', t.ort) order by t.datum), '[]'::jsonb)
    into termine
    from kalender_termine t
   where t.owner_id = inhaber
     and (t.von_partner or coalesce(teilen, false))
     and t.datum <= p_von + (p_tage - 1)
     and (t.wiederholung <> 'nie' or t.datum >= p_von);

  select jsonb_build_object(
           'name', vorname,
           'termineGeteilt', coalesce(teilen, false),
           'termine', termine,
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

-- Kalender-Abo: für Privatkonten ohne gesonderte Freischaltung.
create or replace function public.abo_frei(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select ist_privatkonto(p_user) or funktion_frei(p_user, 'kalender_abo')
$$;
revoke all on function public.abo_frei(uuid) from public, anon, authenticated;

create or replace function public.hat_funktion(p_name text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null
     and (funktion_frei(auth.uid(), p_name) or (p_name = 'kalender_abo' and ist_privatkonto(auth.uid())))
$$;

create or replace function public.abo_erstellen()
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if ich is null or not kalender_nutzer() or not abo_frei(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_abo set beendet_am = now() where user_id = ich and beendet_am is null;
  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_abo (user_id, token_hash)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'));
  return schluessel;
end;
$$;

create or replace function public.abo_status()
returns table(aktiv boolean, erstellt_am timestamptz, zuletzt_abgerufen timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select true, a.erstellt_am, a.zuletzt_abgerufen
    from kalender_abo a
   where a.user_id = auth.uid() and a.beendet_am is null and abo_frei(auth.uid())
$$;

/** Inhaber eines gültigen Abo-Schlüssels – oder NULL. */
create or replace function public.abo_inhaber(p_token text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select a.user_id
    from kalender_abo a
   where a.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (exists (select 1 from profiles p where p.id = a.user_id and p.active and p.employee_id is not null)
          or ist_privatkonto(a.user_id))
     and abo_frei(a.user_id)
$$;
revoke all on function public.abo_inhaber(text) from public, anon, authenticated;

create or replace function public.abo_plan(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := abo_inhaber(p_token);
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  if ist_privatkonto(inhaber) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'tag', t.tag,
             'art', case s.art when 'urlaub' then 'urlaub' when 'krank' then 'abwesend' else 'schicht' end,
             'name', s.name,
             'von', to_char(s.beginn, 'HH24:MI'),
             'bis', to_char(s.ende, 'HH24:MI')) order by t.tag), '[]'::jsonb)
      into ergebnis
      from privat_tage t
      join privat_schichtarten s on s.id = t.schichtart_id
     where t.user_id = inhaber and s.art <> 'frei'
       and t.tag between p_von and p_von + (p_tage - 1);
  else
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
  end if;

  update kalender_abo set zuletzt_abgerufen = now()
   where user_id = inhaber and beendet_am is null
     and (zuletzt_abgerufen is null or zuletzt_abgerufen < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

create or replace function public.abo_termine(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := abo_inhaber(p_token);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'datum', t.datum,
           'titel', t.titel,
           'ganztaegig', t.ganztaegig,
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'wiederholung', t.wiederholung,
           'notiz', t.notiz,
           'ort', t.ort) order by t.datum), '[]'::jsonb)
    into ergebnis
    from (select * from kalender_termine k
           where k.owner_id = inhaber and not k.von_partner
             and (k.datum >= current_date - 60 or k.wiederholung <> 'nie')
           order by k.datum desc
           limit 500) t;

  return ergebnis;
end;
$$;
