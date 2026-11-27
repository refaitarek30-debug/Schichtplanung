-- =============================================================
-- 0249 · Privatkalender: Änderungsstand je Konto
--
-- Beim Öffnen fragt die App nur noch „hat sich bei mir etwas geändert?“
-- (eine Zahl). Ist der Stand gleich dem, der auf dem Handy gemerkt ist,
-- bleiben Schichten, Termine und To-dos vom Handy – ohne neue Abfragen.
--
-- Gezählt wird jede Änderung an den eigenen Schichttagen, Terminen (auch an
-- einzelnen gelöschten Tagen einer Serie) und To-dos – auch wenn eine
-- verbundene Person sie macht – und ein Wechsel des Bundeslands (Feiertage).
-- Der Zähler darf eine Änderung nie verhindern.
--
-- privat_paket: alles für den Start in einer Abfrage. Ist der Stand gleich dem
-- mitgeschickten, kommt nur der Stand zurück.
-- =============================================================

-- Mit dem Konto gelöscht (keine Reste). Beim Löschen eines Kontos schlägt das
-- Hochzählen fehl – das fängt der Auslöser ab, es ist dann ohnehin egal.
create table if not exists public.privat_stand (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stand bigint not null default 0
);
alter table public.privat_stand enable row level security;
revoke all on table public.privat_stand from public, anon, authenticated;

create or replace function public._privat_stand_erhoehen(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_user is null then
    return;
  end if;
  insert into privat_stand (user_id, stand) values (p_user, 1)
  on conflict (user_id) do update set stand = privat_stand.stand + 1;
end;
$$;
revoke all on function public._privat_stand_erhoehen(uuid) from public, anon, authenticated;

-- Auslöser für alle Tabellen; tg_argv[0] = Spalte mit dem Konto.
create or replace function public._privat_stand_ausloeser()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  neu_konto uuid;
  alt_konto uuid;
begin
  begin
    if tg_op <> 'DELETE' then
      neu_konto := (to_jsonb(new) ->> tg_argv[0])::uuid;
    end if;
    if tg_op <> 'INSERT' then
      alt_konto := (to_jsonb(old) ->> tg_argv[0])::uuid;
    end if;
    perform _privat_stand_erhoehen(neu_konto);
    if alt_konto is distinct from neu_konto then
      perform _privat_stand_erhoehen(alt_konto);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function public._privat_stand_ausloeser() from public, anon, authenticated;

drop trigger if exists privat_stand_tage on public.privat_tage;
create trigger privat_stand_tage after insert or update or delete on public.privat_tage
  for each row execute function public._privat_stand_ausloeser('user_id');

drop trigger if exists privat_stand_termine on public.kalender_termine;
create trigger privat_stand_termine after insert or update or delete on public.kalender_termine
  for each row execute function public._privat_stand_ausloeser('owner_id');

drop trigger if exists privat_stand_todos on public.kalender_todos;
create trigger privat_stand_todos after insert or update or delete on public.kalender_todos
  for each row execute function public._privat_stand_ausloeser('owner_id');

-- Ein einzelner Tag aus einer Terminserie gelöscht (0161): zählt beim Inhaber des Termins.
create or replace function public._privat_stand_ausnahme()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  termin uuid;
begin
  begin
    if tg_op = 'DELETE' then
      termin := old.termin_id;
    else
      termin := new.termin_id;
    end if;
    perform _privat_stand_erhoehen((select t.owner_id from kalender_termine t where t.id = termin));
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function public._privat_stand_ausnahme() from public, anon, authenticated;

drop trigger if exists privat_stand_ausnahmen on public.kalender_termin_ausnahmen;
create trigger privat_stand_ausnahmen after insert or update or delete on public.kalender_termin_ausnahmen
  for each row execute function public._privat_stand_ausnahme();

drop trigger if exists privat_stand_land on public.privat_konten;
create trigger privat_stand_land after update of bundesland on public.privat_konten
  for each row execute function public._privat_stand_ausloeser('user_id');

-- Der eigene Stand (0, solange sich nichts geändert hat).
create or replace function public.mein_privat_stand()
returns bigint language sql stable security definer set search_path to 'public' as $$
  select coalesce((select s.stand from privat_stand s where s.user_id = auth.uid()), 0)
$$;
revoke all on function public.mein_privat_stand() from public, anon;
grant execute on function public.mein_privat_stand() to authenticated;

-- Alles für den Start des Privatkalenders in einer Abfrage: eigene Schichten und
-- Feiertage der gewünschten Jahre, Termine, To-dos – oder nur der Stand, wenn er
-- gleich dem mitgeschickten ist. Nutzt dieselben Funktionen wie die Einzelabfragen.
create or replace function public.privat_paket(p_stand bigint, p_jahre integer[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  jetzt bigint;
begin
  if ich is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_jahre is null or cardinality(p_jahre) > 9 then
    raise exception 'Zu viele Jahre.';
  end if;
  jetzt := coalesce((select s.stand from privat_stand s where s.user_id = ich), 0);
  if p_stand is not null and p_stand = jetzt then
    return jsonb_build_object('stand', jetzt);
  end if;
  return jsonb_build_object(
    'stand', jetzt,
    'termine', coalesce((select jsonb_agg(to_jsonb(t)) from meine_termine() t), '[]'::jsonb),
    'todos', coalesce((select jsonb_agg(to_jsonb(x)) from meine_todos() x), '[]'::jsonb),
    'jahre', coalesce((
      select jsonb_object_agg(j::text, jsonb_build_object(
               'tage', coalesce((select jsonb_agg(jsonb_build_object('tag', t.tag, 'ebene', t.ebene, 'schichtart_id', t.schichtart_id)
                                                  order by t.tag, t.ebene)
                                   from privat_tage t
                                  where t.user_id = ich and t.tag between make_date(j, 1, 1) and make_date(j, 12, 31)), '[]'::jsonb),
               'feiertage', coalesce((select jsonb_agg(to_jsonb(f)) from privat_feiertage(j) f), '[]'::jsonb)))
        from unnest(p_jahre) as j
       where j between 2000 and 2100), '{}'::jsonb));
end;
$$;
revoke all on function public.privat_paket(bigint, integer[]) from public, anon;
grant execute on function public.privat_paket(bigint, integer[]) to authenticated;
