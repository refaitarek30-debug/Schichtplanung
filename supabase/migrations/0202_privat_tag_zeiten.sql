-- Privatbereich: andere Uhrzeit an einem einzelnen Tag (09.11.2026).
--
-- Beispiel: Die Spätschicht an der Tankstelle geht heute 17:00–23:30 statt
-- 18:00–24:00. Die Schichtart bleibt, nur an diesem Tag gilt eine andere Zeit
-- (für Stunden, Zuschläge und Geld). Gilt nur, solange genau diese Schicht an
-- dem Tag eingetragen ist: Wird sie entfernt oder ersetzt, löscht ein Trigger
-- die Zeit mit.
--
-- Nur die Person selbst liest und schreibt (wie privat_tage). Kein Lohn hier –
-- Lohn und Zuschläge bleiben im Browser.

create table if not exists public.privat_tag_zeiten (
  user_id uuid not null references public.privat_konten (user_id) on delete cascade,
  tag date not null,
  schichtart_id uuid not null,
  beginn time not null,
  ende time not null,
  primary key (user_id, tag, schichtart_id),
  foreign key (user_id, schichtart_id)
    references public.privat_schichtarten (user_id, id) on delete cascade,
  check (beginn <> ende)
);
create index if not exists privat_tag_zeiten_art on public.privat_tag_zeiten (user_id, schichtart_id);

alter table public.privat_tag_zeiten enable row level security;
drop policy if exists privat_tag_zeiten_eigen on public.privat_tag_zeiten;
create policy privat_tag_zeiten_eigen on public.privat_tag_zeiten
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.privat_tag_zeiten from anon, authenticated;
grant select, insert, update, delete on public.privat_tag_zeiten to authenticated;

-- Schicht weg oder ersetzt -> abweichende Zeit weg.
create or replace function public.privat_tag_zeiten_aufraeumen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.schichtart_id = old.schichtart_id and new.tag = old.tag then
    return null;
  end if;
  delete from privat_tag_zeiten z
   where z.user_id = old.user_id
     and z.tag = old.tag
     and z.schichtart_id = old.schichtart_id
     and not exists (
       select 1 from privat_tage t
        where t.user_id = old.user_id and t.tag = old.tag and t.schichtart_id = old.schichtart_id
     );
  return null;
end;
$$;
revoke execute on function public.privat_tag_zeiten_aufraeumen() from public, anon, authenticated;

drop trigger if exists privat_tage_zeiten_aufraeumen on public.privat_tage;
create trigger privat_tage_zeiten_aufraeumen
  after delete or update on public.privat_tage
  for each row execute function public.privat_tag_zeiten_aufraeumen();
