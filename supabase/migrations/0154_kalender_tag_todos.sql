-- Tagesansicht, To-dos und Vorschläge (privat und Firma).
--
-- * Termine: ganztägig über mehrere Tage (bis_datum) und eine Erinnerung.
-- * To-dos: eigene Liste, optional mit Tag und Uhrzeit. Sieht nur die
--   Person selbst.
-- * Vorlieben: wofür man den Kalender nutzt (Schule, Studium, …) und
--   eigene Vorlagen für Termine. Nur für die Vorschläge.
--
-- Zugriff wie bei den Terminen nur über Funktionen; die Tabellen selbst
-- sind für Clients gesperrt.

-- ---- Termine: mehrtägig und Erinnerung ------------------------------------

alter table public.kalender_termine
  add column if not exists bis_datum date,
  add column if not exists erinnerung text;

alter table public.kalender_termine
  drop constraint if exists kalender_termine_bis_datum_check,
  add constraint kalender_termine_bis_datum_check
    check (bis_datum is null or (bis_datum >= datum and bis_datum <= datum + 62));

alter table public.kalender_termine
  drop constraint if exists kalender_termine_erinnerung_check,
  add constraint kalender_termine_erinnerung_check
    check (erinnerung is null or erinnerung in ('m10', 'h1', 'd1', 'morgens8', 'vortag18', 'tag8', 'd2'));

-- Speichern wie termin_speichern, dazu Enddatum und Erinnerung.
create or replace function public.termin_sichern(
  p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text, p_erinnerung text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  neu uuid;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum then p_bis_datum end;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if bis is not null and bis > p_datum + 62 then
    raise exception 'Ein Termin kann höchstens zwei Monate lang sein.';
  end if;
  if p_erinnerung is not null and p_erinnerung not in ('m10', 'h1', 'd1', 'morgens8', 'vortag18', 'tag8', 'd2') then
    raise exception 'Diese Erinnerung gibt es nicht.';
  end if;
  -- Erst das alte Enddatum lösen – sonst stört es, wenn der Beginn wandert.
  if p_id is not null then
    update kalender_termine set bis_datum = null where id = p_id and owner_id = auth.uid();
  end if;
  neu := termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set bis_datum = bis, erinnerung = p_erinnerung
   where id = neu and owner_id = auth.uid();
  return neu;
end;
$$;

revoke all on function public.termin_sichern(uuid, date, date, text, boolean, time, time, text, text, text, text) from public, anon;
grant execute on function public.termin_sichern(uuid, date, date, text, boolean, time, time, text, text, text, text) to authenticated;

-- meine_termine liefert jetzt auch bis_datum und erinnerung (neuer
-- Rückgabetyp – daher neu angelegt).
drop function if exists public.meine_termine();
create function public.meine_termine()
returns table(id uuid, von_partner boolean, person_id uuid, datum date, bis_datum date, titel text,
              ganztaegig boolean, beginn text, ende text, wiederholung text, notiz text, ort text, erinnerung text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.person_id, t.datum, t.bis_datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort, t.erinnerung
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$$;

revoke all on function public.meine_termine() from public, anon;
grant execute on function public.meine_termine() to authenticated;

-- Kalender-Abo: mehrtägige Termine bis zum letzten Tag.
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
           'bis', t.bis_datum,
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
             and (coalesce(k.bis_datum, k.datum) >= current_date - 60 or k.wiederholung <> 'nie')
           order by k.datum desc
           limit 500) t;

  return ergebnis;
end;
$$;

-- ---- To-dos ------------------------------------------------------------------

create table if not exists public.kalender_todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  titel text not null check (char_length(titel) between 1 and 120),
  datum date,
  uhrzeit time,
  erledigt boolean not null default false,
  erledigt_am timestamptz,
  erstellt_am timestamptz not null default now()
);

create index if not exists kalender_todos_owner on public.kalender_todos (owner_id, erledigt, datum);

alter table public.kalender_todos enable row level security;
revoke all on public.kalender_todos from anon, authenticated;

create or replace function public.meine_todos()
returns table(id uuid, titel text, datum date, uhrzeit text, erledigt boolean, erledigt_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  -- Erledigtes nur noch 14 Tage lang.
  return query
    select t.id, t.titel, t.datum, to_char(t.uhrzeit, 'HH24:MI'), t.erledigt, t.erledigt_am
      from kalender_todos t
     where t.owner_id = auth.uid()
       and (not t.erledigt or t.erledigt_am > now() - interval '14 days')
     order by t.erledigt, t.datum nulls last, t.uhrzeit nulls last, t.erstellt_am;
end;
$$;

create or replace function public.todo_speichern(p_id uuid, p_titel text, p_datum date, p_uhrzeit time)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  neu uuid;
  v_titel text := left(btrim(coalesce(p_titel, '')), 120);
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_titel = '' then
    raise exception 'Was steht an? Der Text fehlt noch.';
  end if;
  if p_id is null then
    -- Alt Erledigtes aufräumen, dann die Obergrenze prüfen.
    delete from kalender_todos
     where owner_id = auth.uid() and erledigt and erledigt_am < now() - interval '30 days';
    if (select count(*) from kalender_todos where owner_id = auth.uid()) >= 1000 then
      raise exception 'Zu viele To-dos – hak ein paar ab oder lösch sie.';
    end if;
    insert into kalender_todos (owner_id, titel, datum, uhrzeit)
    values (auth.uid(), v_titel, p_datum, case when p_datum is null then null else p_uhrzeit end)
    returning id into neu;
    return neu;
  end if;
  update kalender_todos
     set titel = v_titel, datum = p_datum,
         uhrzeit = case when p_datum is null then null else p_uhrzeit end
   where id = p_id and owner_id = auth.uid()
  returning id into neu;
  if neu is null then
    raise exception 'To-do nicht gefunden.';
  end if;
  return neu;
end;
$$;

create or replace function public.todo_erledigt(p_id uuid, p_an boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_todos
     set erledigt = coalesce(p_an, false),
         erledigt_am = case when coalesce(p_an, false) then now() end
   where id = p_id and owner_id = auth.uid();
end;
$$;

create or replace function public.todo_loeschen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  delete from kalender_todos where id = p_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.meine_todos() from public, anon;
revoke all on function public.todo_speichern(uuid, text, date, time) from public, anon;
revoke all on function public.todo_erledigt(uuid, boolean) from public, anon;
revoke all on function public.todo_loeschen(uuid) from public, anon;
grant execute on function public.meine_todos() to authenticated;
grant execute on function public.todo_speichern(uuid, text, date, time) to authenticated;
grant execute on function public.todo_erledigt(uuid, boolean) to authenticated;
grant execute on function public.todo_loeschen(uuid) to authenticated;

-- ---- Vorlieben: wofür man den Kalender nutzt, eigene Vorlagen ---------------

create table if not exists public.kalender_vorlieben (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rollen text[] not null default '{}',
  vorlagen jsonb not null default '[]'::jsonb,
  gefragt boolean not null default false,
  geaendert_am timestamptz not null default now()
);

alter table public.kalender_vorlieben enable row level security;
revoke all on public.kalender_vorlieben from anon, authenticated;

create or replace function public.meine_vorlieben()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v kalender_vorlieben;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into v from kalender_vorlieben where user_id = auth.uid();
  return jsonb_build_object(
    'rollen', coalesce(to_jsonb(v.rollen), '[]'::jsonb),
    'vorlagen', coalesce(v.vorlagen, '[]'::jsonb),
    'gefragt', coalesce(v.gefragt, false));
end;
$$;

-- p_rollen / p_vorlagen null = unverändert lassen.
create or replace function public.vorlieben_setzen(p_rollen text[], p_vorlagen jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_rollen text[];
  v_vorlagen jsonb;
  e jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  if p_rollen is not null then
    select coalesce(array_agg(distinct r), '{}') into v_rollen
      from unnest(p_rollen) r
     where r in ('schule', 'studium', 'job', 'schicht', 'eltern', 'anders');
  end if;

  if p_vorlagen is not null then
    if jsonb_typeof(p_vorlagen) <> 'array' or jsonb_array_length(p_vorlagen) > 12 then
      raise exception 'Höchstens 12 eigene Vorlagen.';
    end if;
    v_vorlagen := '[]'::jsonb;
    for e in select * from jsonb_array_elements(p_vorlagen) loop
      if jsonb_typeof(e) <> 'object' or btrim(coalesce(e->>'titel', '')) = '' then
        raise exception 'Eine Vorlage braucht einen Namen.';
      end if;
      v_vorlagen := v_vorlagen || jsonb_build_array(jsonb_build_object(
        'icon', left(coalesce(e->>'icon', ''), 8),
        'titel', left(btrim(e->>'titel'), 40),
        'min', least(greatest(coalesce((e->>'min')::int, 60), 0), 1440)));
    end loop;
  end if;

  insert into kalender_vorlieben (user_id, rollen, vorlagen, gefragt)
  values (auth.uid(), coalesce(v_rollen, '{}'), coalesce(v_vorlagen, '[]'::jsonb), true)
  on conflict (user_id) do update
     set rollen = coalesce(v_rollen, kalender_vorlieben.rollen),
         vorlagen = coalesce(v_vorlagen, kalender_vorlieben.vorlagen),
         gefragt = true,
         geaendert_am = now();
end;
$$;

revoke all on function public.meine_vorlieben() from public, anon;
revoke all on function public.vorlieben_setzen(text[], jsonb) from public, anon;
grant execute on function public.meine_vorlieben() to authenticated;
grant execute on function public.vorlieben_setzen(text[], jsonb) to authenticated;
