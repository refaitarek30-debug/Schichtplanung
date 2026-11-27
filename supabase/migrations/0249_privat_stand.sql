-- =============================================================
-- 0249 · Privatkalender: Änderungsstand je Konto
--
-- Beim Öffnen fragt die App nur noch „hat sich bei mir etwas geändert?“
-- (eine Zahl). Ist der Stand gleich dem, der auf dem Handy gemerkt ist,
-- bleiben Schichten, Termine und To-dos vom Handy – ohne neue Abfragen.
--
-- Gezählt wird jede Änderung an den eigenen Schichttagen, Terminen und To-dos
-- (auch wenn eine verbundene Person sie macht) und ein Wechsel des
-- Bundeslands (Feiertage). Der Zähler darf eine Änderung nie verhindern.
-- =============================================================

create table if not exists public.privat_stand (
  user_id uuid primary key,
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
