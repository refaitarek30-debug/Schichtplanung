-- Hinweise an einzelne Personen.
--
-- Die Schichtleitung schreibt einer oder mehreren Personen einen kurzen
-- Hinweis („Bitte stell deinen Urlaubsantrag noch einmal“). Die Person sieht
-- ihn beim nächsten Öffnen der App als Fenster und bestätigt mit
-- „Verstanden“ – eine Antwort gibt es nicht. Auf Wunsch kommt zusätzlich eine
-- Mitteilung aufs Handy, standardmäßig erst zur nächsten eigenen Schicht,
-- damit niemand in der Freizeit von der Arbeit hört.
--
-- Zugriff nur über die Funktionen unten (security definer), nicht direkt.
-- Hinweise werden nach 90 Tagen gelöscht.

create table if not exists public.hinweise (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  von_profile uuid references public.profiles(id) on delete set null,
  von_name text not null default '',
  text text not null check (char_length(text) between 1 and 300),
  ziel text check (ziel in ('/urlaub', '/meine-schichten', '/kalender', '/start')),
  push text not null default 'schicht' check (push in ('schicht', 'sofort', 'aus')),
  push_ab timestamptz,
  erstellt_am timestamptz not null default now(),
  gelesen_am timestamptz,
  zurueckgezogen_am timestamptz
);
create index if not exists hinweise_offen on public.hinweise (employee_id) where gelesen_am is null and zurueckgezogen_am is null;
create index if not exists hinweise_firma on public.hinweise (company_id, erstellt_am desc);
alter table public.hinweise enable row level security;
revoke all on public.hinweise from anon, authenticated;

-- ---- Push: später senden ----------------------------------------------------------

alter table public.push_warteschlange add column if not exists senden_ab timestamptz;
alter table public.push_warteschlange drop constraint if exists push_warteschlange_art_check;
alter table public.push_warteschlange add constraint push_warteschlange_art_check
  check (art in ('antraege', 'plan', 'einspringen', 'teilen', 'hinweis'));

create or replace function public.push_warteschlange_holen()
returns table(user_id uuid, titel text, text text, url text, tag text)
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from push_warteschlange where coalesce(senden_ab, erstellt_am) < now() - interval '7 days';
  return query
    update push_warteschlange w set gesendet_am = now()
     where w.id in (select x.id from push_warteschlange x
                     where x.gesendet_am is null
                       and (x.senden_ab is null or x.senden_ab <= now())
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
  ) and not exists (select 1 from push_warteschlange
                     where gesendet_am is null and (senden_ab is null or senden_ab <= now())) then
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
revoke all on function public.erinnerungen_anstossen() from public, anon, authenticated;

-- ---- Wann arbeitet die Person das nächste Mal? -----------------------------------------
--
-- Läuft gerade eine Schicht: jetzt. Sonst 15 Minuten nach Beginn der
-- nächsten Schicht (nicht im Urlaub, nicht krank) in den nächsten 14 Tagen.
-- Ohne Schichtplan: Montag bis Freitag 8 bis 16 Uhr.

create or replace function public.naechste_arbeitszeit(p_employee uuid)
returns timestamptz language plpgsql stable security definer set search_path to 'public' as $$
declare
  jetzt timestamptz := now();
  heute date := (now() at time zone 'Europe/Berlin')::date;
  d date;
  sid uuid;
  s shifts;
  beginn timestamptz;
  ende timestamptz;
  gefunden boolean := false;
begin
  for i in -1..14 loop
    d := heute + i;
    sid := effective_shift_id(p_employee, d);
    continue when sid is null;
    gefunden := true;
    select * into s from shifts where id = sid;
    continue when s.id is null or s.start_time is null or s.end_time is null;
    continue when not schicht_laeuft_fuer(p_employee, d, s);
    continue when exists (select 1 from leave_requests l
                           where l.employee_id = p_employee and l.status = 'approved'
                             and d between l.start_date and l.end_date);
    continue when exists (select 1 from absences a where a.employee_id = p_employee and a.date = d);
    beginn := (d + s.start_time) at time zone 'Europe/Berlin';
    ende := (d + s.end_time) at time zone 'Europe/Berlin';
    if ende <= beginn then
      ende := ende + interval '1 day';
    end if;
    if jetzt >= beginn and jetzt < ende then
      return jetzt;
    end if;
    if beginn > jetzt then
      return beginn + interval '15 minutes';
    end if;
  end loop;

  if gefunden then
    -- Schichten, aber keine passende in den nächsten 14 Tagen: beim Öffnen reicht.
    return null;
  end if;

  -- Ohne Schichtplan: Werktage 8–16 Uhr.
  for i in 0..7 loop
    d := heute + i;
    continue when extract(isodow from d) > 5;
    beginn := (d + time '08:00') at time zone 'Europe/Berlin';
    ende := (d + time '16:00') at time zone 'Europe/Berlin';
    if jetzt >= beginn and jetzt < ende then
      return jetzt;
    end if;
    if beginn > jetzt then
      return beginn;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.naechste_arbeitszeit(uuid) from public, anon, authenticated;

-- ---- Senden ---------------------------------------------------------------------------

create or replace function public.hinweis_senden(
  p_empfaenger uuid[],
  p_text text,
  p_ziel text default null,
  p_push text default 'schicht'
) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  ich profiles;
  emp employees;
  neu hinweise;
  konto uuid;
  ab timestamptz;
  anzahl integer := 0;
  text_sauber text := btrim(coalesce(p_text, ''));
begin
  select * into ich from profiles where id = auth.uid() and active;
  if ich.id is null or ich.role not in ('shift_leader', 'admin') then
    raise exception 'Nur Schichtleitung oder Administration dürfen Hinweise schicken.';
  end if;
  if text_sauber = '' then
    raise exception 'Bitte einen Text eingeben.';
  end if;
  if char_length(text_sauber) > 300 then
    raise exception 'Der Hinweis darf höchstens 300 Zeichen lang sein.';
  end if;
  if p_ziel is not null and p_ziel not in ('/urlaub', '/meine-schichten', '/kalender', '/start') then
    raise exception 'Ungültiges Ziel.';
  end if;
  if coalesce(p_push, 'schicht') not in ('schicht', 'sofort', 'aus') then
    raise exception 'Ungültige Auswahl für die Mitteilung.';
  end if;
  if p_empfaenger is null or cardinality(p_empfaenger) = 0 then
    raise exception 'Bitte mindestens eine Person auswählen.';
  end if;
  if cardinality(p_empfaenger) > 200 then
    raise exception 'Höchstens 200 Personen auf einmal.';
  end if;

  delete from hinweise where company_id = ich.company_id and erstellt_am < now() - interval '90 days';

  for emp in select * from employees
              where id = any(p_empfaenger) and company_id = ich.company_id and active loop
    ab := case coalesce(p_push, 'schicht')
            when 'sofort' then now()
            when 'schicht' then naechste_arbeitszeit(emp.id)
            else null end;
    insert into hinweise (company_id, employee_id, von_profile, von_name, text, ziel, push, push_ab)
    values (ich.company_id, emp.id, ich.id,
            concat_ws(' ', ich.first_name, ich.last_name),
            text_sauber, p_ziel, coalesce(p_push, 'schicht'), ab)
    returning * into neu;
    anzahl := anzahl + 1;

    if ab is not null then
      konto := konto_zu_mitarbeiter(emp.id);
      if konto is not null and exists (select 1 from push_abos where user_id = konto) then
        insert into push_warteschlange (user_id, art, titel, text, url, tag, senden_ab)
        values (konto, 'hinweis', '💬 Hinweis von ' || coalesce(nullif(neu.von_name, ''), 'deiner Schichtleitung'),
                left(text_sauber, 300), coalesce(p_ziel, '/start'), 'hinweis-' || neu.id::text, ab);
      end if;
    end if;
  end loop;

  if anzahl = 0 then
    raise exception 'Keine der ausgewählten Personen gehört zu deinem Betrieb.';
  end if;
  return anzahl;
end;
$$;
revoke all on function public.hinweis_senden(uuid[], text, text, text) from public, anon;
grant execute on function public.hinweis_senden(uuid[], text, text, text) to authenticated;

-- ---- Empfangen ------------------------------------------------------------------------

create or replace function public.meine_hinweise()
returns table(id uuid, text text, ziel text, von_name text, erstellt_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select h.id, h.text, h.ziel, h.von_name, h.erstellt_am
    from hinweise h
   where h.employee_id = auth_employee_id()
     and h.gelesen_am is null and h.zurueckgezogen_am is null
   order by h.erstellt_am
   limit 10
$$;
revoke all on function public.meine_hinweise() from public, anon;
grant execute on function public.meine_hinweise() to authenticated;

create or replace function public.hinweis_gelesen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update hinweise set gelesen_am = now()
   where id = p_id and employee_id = auth_employee_id() and gelesen_am is null;
  if found then
    -- Schon gelesen: die geplante Mitteilung aufs Handy ist überflüssig.
    delete from push_warteschlange where tag = 'hinweis-' || p_id::text and gesendet_am is null;
  end if;
end;
$$;
revoke all on function public.hinweis_gelesen(uuid) from public, anon;
grant execute on function public.hinweis_gelesen(uuid) to authenticated;

-- ---- Übersicht für die Leitung -----------------------------------------------------------

create or replace function public.hinweise_gesendet(p_limit integer default 30)
returns table(
  id uuid, employee_id uuid, empfaenger text, text text, ziel text, push text, push_ab timestamptz,
  push_gesendet boolean, von_name text, erstellt_am timestamptz, gelesen_am timestamptz,
  zurueckgezogen_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select h.id, h.employee_id, concat_ws(' ', e.first_name, e.last_name), h.text, h.ziel, h.push, h.push_ab,
           exists (select 1 from push_warteschlange w where w.tag = 'hinweis-' || h.id::text and w.gesendet_am is not null),
           h.von_name, h.erstellt_am, h.gelesen_am, h.zurueckgezogen_am
      from hinweise h join employees e on e.id = h.employee_id
     where h.company_id = auth_company_id()
     order by h.erstellt_am desc
     limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;
revoke all on function public.hinweise_gesendet(integer) from public, anon;
grant execute on function public.hinweise_gesendet(integer) to authenticated;

create or replace function public.hinweis_zurueckziehen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update hinweise set zurueckgezogen_am = now()
   where id = p_id and company_id = auth_company_id() and gelesen_am is null and zurueckgezogen_am is null;
  if found then
    delete from push_warteschlange where tag = 'hinweis-' || p_id::text and gesendet_am is null;
  end if;
end;
$$;
revoke all on function public.hinweis_zurueckziehen(uuid) from public, anon;
grant execute on function public.hinweis_zurueckziehen(uuid) to authenticated;
