-- Mitteilungen aufs Handy für alle (Web Push, siehe 0155).
--
-- * Jede Benachrichtigung der Glocke (notifications: Urlaub genehmigt,
--   abgelehnt, neuer Antrag, Fehlzeit, Einspringen …) geht zusätzlich als
--   Mitteilung an die Geräte der Person.
-- * Neu: Planänderung durch die Schichtleitung (mehrere Tage werden zu
--   einer Mitteilung zusammengefasst), Termin von Partner/Familie
--   eingetragen, neue Verbindung, neues Gruppenmitglied.
-- * Jede Person kann Arten von Mitteilungen abschalten (push_vorlieben).
-- * Versand: pg_cron (erinnerungen_anstossen) stößt /api/erinnerungen an,
--   sobald etwas in der Warteschlange liegt.

create table if not exists public.push_warteschlange (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  art text not null check (art in ('antraege', 'plan', 'einspringen', 'teilen')),
  titel text not null,
  text text not null default '',
  url text not null default '/start',
  tag text,
  -- Gleicher Schlüssel, noch nicht gesendet: wird zusammengefasst.
  sammel text,
  anzahl integer not null default 1,
  erstellt_am timestamptz not null default now(),
  gesendet_am timestamptz
);
create index if not exists push_warteschlange_offen on public.push_warteschlange (id) where gesendet_am is null;
create index if not exists push_warteschlange_sammel on public.push_warteschlange (user_id, sammel) where gesendet_am is null;
alter table public.push_warteschlange enable row level security;
revoke all on public.push_warteschlange from anon, authenticated;

create table if not exists public.push_vorlieben (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aus text[] not null default '{}'
);
alter table public.push_vorlieben enable row level security;
revoke all on public.push_vorlieben from anon, authenticated;

-- ---- Einreihen ---------------------------------------------------------------------

create or replace function public.push_einreihen(
  p_user uuid, p_art text, p_titel text, p_text text, p_url text, p_tag text, p_sammel text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  offen bigint;
begin
  if p_user is null or not exists (select 1 from push_abos where user_id = p_user) then
    return;
  end if;
  if exists (select 1 from push_vorlieben where user_id = p_user and p_art = any(aus)) then
    return;
  end if;
  if p_sammel is not null then
    select id into offen from push_warteschlange
     where user_id = p_user and sammel = p_sammel and gesendet_am is null
     order by id desc limit 1;
    if offen is not null then
      update push_warteschlange
         set anzahl = anzahl + 1, titel = left(p_titel, 120), text = left(coalesce(p_text, ''), 300)
       where id = offen;
      return;
    end if;
  end if;
  insert into push_warteschlange (user_id, art, titel, text, url, tag, sammel)
  values (p_user, p_art, left(p_titel, 120), left(coalesce(p_text, ''), 300), coalesce(p_url, '/start'), p_tag, p_sammel);
end;
$$;
revoke all on function public.push_einreihen(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Konto zu einem Mitarbeiter (aktives Profil).
create or replace function public.konto_zu_mitarbeiter(p_employee uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select p.id from profiles p where p.employee_id = p_employee and p.active order by p.id limit 1
$$;
revoke all on function public.konto_zu_mitarbeiter(uuid) from public, anon, authenticated;

-- ---- Auslöser: Glocke ----------------------------------------------------------------

create or replace function public.push_aus_benachrichtigung()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  art text := case
    when new.type = 'replacement_requested' then 'einspringen'
    when new.type = 'fehlzeit' then 'plan'
    else 'antraege' end;
  ziel text := case
    when new.type = 'leave_submitted' then '/urlaubsantraege'
    when new.type like 'leave_%' then '/urlaub'
    else '/start' end;
begin
  begin
    perform push_einreihen(konto_zu_mitarbeiter(new.employee_id), art, new.title, coalesce(new.body, ''), ziel,
                           'glocke-' || new.id::text, null);
  exception when others then
    -- Eine Mitteilung darf die eigentliche Aktion nie verhindern.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists push_benachrichtigung on public.notifications;
create trigger push_benachrichtigung after insert on public.notifications
  for each row execute function public.push_aus_benachrichtigung();

-- ---- Auslöser: Planänderung durch die Schichtleitung --------------------------------------

create or replace function public.push_aus_planaenderung()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  zeile shift_assignments := coalesce(new, old);
  konto uuid;
  schicht text;
  tag text;
begin
  begin
    if zeile.date < current_date or zeile.date > current_date + 60 then
      return null;
    end if;
    if tg_op = 'UPDATE' and new.shift_id is not distinct from old.shift_id then
      return null;
    end if;
    konto := konto_zu_mitarbeiter(zeile.employee_id);
    -- Wer selbst ändert, braucht keine Mitteilung.
    if konto is null or konto = auth.uid() then
      return null;
    end if;
    tag := to_char(zeile.date, 'DD.MM.');
    if tg_op = 'DELETE' then
      schicht := 'wieder laut Schichtfolge';
    else
      select s.name into schicht from shifts s where s.id = new.shift_id;
      schicht := coalesce('jetzt ' || schicht, 'jetzt frei');
    end if;
    perform push_einreihen(konto, 'plan', '📅 Dein Plan wurde geändert', tag || ': ' || schicht, '/meine-schichten',
                           'plan', 'plan');
    -- Mehrere Tage auf einmal: zusammenfassen.
    update push_warteschlange
       set text = 'An ' || anzahl || ' Tagen geändert – zuletzt ' || tag || ': ' || schicht
     where user_id = konto and sammel = 'plan' and gesendet_am is null and anzahl > 1;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists push_planaenderung on public.shift_assignments;
create trigger push_planaenderung after insert or update or delete on public.shift_assignments
  for each row execute function public.push_aus_planaenderung();

-- ---- Auslöser: Partner, Familie, Verbindungen, Gruppen ----------------------------------

create or replace function public.push_aus_termin_von_anderen()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  wer text;
  aktuell_user uuid;
  aktuell_person uuid;
begin
  begin
    if not new.von_partner then
      return null;
    end if;
    -- Aufgeschoben bis zum Ende der Transaktion: der aktuelle Stand der
    -- Zeile (von_user bzw. person_id werden erst nach dem Einfügen gesetzt).
    select t.von_user, t.person_id into aktuell_user, aktuell_person from kalender_termine t where t.id = new.id;
    if aktuell_user is not null then
      wer := inhaber_vorname(aktuell_user);
    elsif aktuell_person is not null then
      select name into wer from kalender_personen where id = aktuell_person;
    end if;
    perform push_einreihen(new.owner_id, 'teilen',
      '🗓️ ' || coalesce(nullif(wer, ''), 'Jemand') || ' hat etwas eingetragen',
      coalesce(nullif(new.titel, ''), 'Termin') || ' · ' || to_char(new.datum, 'DD.MM.')
        || case when new.beginn is not null then ' ' || to_char(new.beginn, 'HH24:MI') else '' end,
      '/start', 'termin-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- Erst nach dem Speichern von von_user (Verbindungen setzen es im zweiten Schritt).
drop trigger if exists push_termin_von_anderen on public.kalender_termine;
create constraint trigger push_termin_von_anderen after insert on public.kalender_termine
  deferrable initially deferred
  for each row execute function public.push_aus_termin_von_anderen();

create or replace function public.push_aus_verbindung()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  neu uuid := auth.uid();
  einlader uuid := case when new.a = auth.uid() then new.b else new.a end;
begin
  begin
    perform push_einreihen(einlader, 'teilen',
      '🔗 ' || coalesce(nullif(inhaber_vorname(neu), ''), 'Jemand') || ' ist jetzt mit dir verbunden',
      'Ihr seht gegenseitig eure Schichten. Unter Teilen stellst du ein, was sie noch sehen darf.',
      '/start', 'verbindung-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists push_verbindung on public.kalender_verbindungen;
create trigger push_verbindung after insert on public.kalender_verbindungen
  for each row execute function public.push_aus_verbindung();

create or replace function public.push_aus_gruppenbeitritt()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  g text;
  m record;
begin
  begin
    select name into g from kalender_gruppen where id = new.gruppe_id;
    for m in select user_id from kalender_gruppen_mitglieder where gruppe_id = new.gruppe_id and user_id <> new.user_id loop
      perform push_einreihen(m.user_id, 'teilen',
        '👋 ' || coalesce(nullif(inhaber_vorname(new.user_id), ''), 'Jemand') || ' ist in „' || coalesce(g, 'eurer Gruppe') || '“',
        'Ihr seht jetzt auch ihre Schichten.', '/start', 'gruppe-' || new.gruppe_id::text || '-' || new.user_id::text, null);
    end loop;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists push_gruppenbeitritt on public.kalender_gruppen_mitglieder;
create trigger push_gruppenbeitritt after insert on public.kalender_gruppen_mitglieder
  for each row execute function public.push_aus_gruppenbeitritt();

-- ---- Für den Server ------------------------------------------------------------------------

create or replace function public.push_warteschlange_holen()
returns table(user_id uuid, titel text, text text, url text, tag text)
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from push_warteschlange where erstellt_am < now() - interval '7 days';
  return query
    update push_warteschlange w set gesendet_am = now()
     where w.id in (select x.id from push_warteschlange x
                     where x.gesendet_am is null
                       -- Planänderungen kurz sammeln (mehrere Tage am Stück).
                       and (x.sammel is null or x.erstellt_am < now() - interval '45 seconds')
                     order by x.id limit 300 for update skip locked)
    returning w.user_id, w.titel, w.text, w.url, w.tag;
end;
$$;
revoke all on function public.push_warteschlange_holen() from public, anon, authenticated;
grant execute on function public.push_warteschlange_holen() to service_role;

create or replace function public.erinnerungen_anstossen()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  geheimnis text;
begin
  if not exists (
    select 1 from erinnerungen_im_fenster() f
     where exists (select 1 from push_abos p where p.user_id = f.user_id)
  ) and not exists (select 1 from push_warteschlange where gesendet_am is null) then
    return;
  end if;
  select decrypted_secret into geheimnis from vault.decrypted_secrets where name = 'erinnerung_geheimnis';
  if geheimnis is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ready-flame.vercel.app/api/erinnerungen',
    headers := jsonb_build_object('content-type', 'application/json', 'x-erinnerung', geheimnis),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

-- ---- Einstellungen: welche Arten aus ------------------------------------------------------

create or replace function public.meine_push_vorlieben()
returns text[] language sql stable security definer set search_path to 'public' as $$
  select coalesce((select aus from push_vorlieben where user_id = auth.uid()), '{}')
$$;

create or replace function public.push_vorlieben_setzen(p_aus text[])
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  insert into push_vorlieben (user_id, aus)
  values (auth.uid(), coalesce((select array_agg(distinct a) from unnest(p_aus) a
                                  where a in ('antraege', 'plan', 'einspringen', 'teilen')), '{}'))
  on conflict (user_id) do update set aus = excluded.aus;
end;
$$;

revoke all on function public.meine_push_vorlieben() from public, anon;
revoke all on function public.push_vorlieben_setzen(text[]) from public, anon;
grant execute on function public.meine_push_vorlieben() to authenticated;
grant execute on function public.push_vorlieben_setzen(text[]) to authenticated;

-- Mitteilungen auch ohne Kalender-Zugang (z. B. Schichtleitung): Geräte
-- anmelden darf jede angemeldete Person.
create or replace function public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  insert into push_abos (user_id, endpoint, p256dh, auth, geraet)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_geraet, ''), 60))
  on conflict (endpoint) do update
     set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
         geraet = excluded.geraet, erstellt_am = now();
  delete from push_abos
   where user_id = auth.uid()
     and id not in (select id from push_abos where user_id = auth.uid() order by erstellt_am desc limit 10);
end;
$$;
