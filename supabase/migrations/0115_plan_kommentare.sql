-- Kommentare im Schichtplan.
--
-- Jeder im Unternehmen darf zu einem Tag einer Person im Plan einen kurzen
-- Kommentar schreiben (langes Drücken auf die Zelle). Die Zelle zeigt dann
-- einen kleinen roten Strich; der Text erscheint beim Antippen bzw. beim
-- Überfahren mit der Maus.
--
-- Sichtbarkeit: wie der Plan selbst – alle im eigenen Unternehmen, niemand
-- darüber hinaus. Löschen darf, wer den Kommentar geschrieben hat, und die
-- Führung. Ändern ist nicht vorgesehen (löschen und neu schreiben).
--
-- Unternehmen, Autor und Autorname setzt die Datenbank selbst – nicht der
-- Aufrufer. So kann niemand im Namen eines anderen oder in eine fremde
-- Firma schreiben.

create table if not exists public.plan_kommentare (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  tag date not null,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  autor_id uuid references public.profiles(id) on delete set null,
  autor_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists plan_kommentare_firma_tag
  on public.plan_kommentare (company_id, tag);
create index if not exists plan_kommentare_person
  on public.plan_kommentare (employee_id);

comment on table public.plan_kommentare is
  'Kommentare zu einem Tag einer Person im Schichtplan. Für alle im Unternehmen sichtbar.';

-- Vor dem Einfügen: Firma, Autor und Name aus der Sitzung, Person muss zur
-- eigenen Firma gehören.
create or replace function public.plan_kommentar_vorbereiten()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  name text;
begin
  if firma is null or auth.uid() is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  if not exists (
    select 1 from employees e where e.id = new.employee_id and e.company_id = firma
  ) then
    raise exception 'Diese Person gehört nicht zu deinem Unternehmen.';
  end if;

  select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    into name
    from profiles p
   where p.id = auth.uid();

  new.company_id := firma;
  new.autor_id := auth.uid();
  new.autor_name := coalesce(nullif(name, ''), 'Unbekannt');
  new.text := btrim(new.text);
  new.created_at := now();
  return new;
end;
$function$;

revoke all on function public.plan_kommentar_vorbereiten() from public, anon, authenticated;

drop trigger if exists plan_kommentar_vorbereiten on public.plan_kommentare;
create trigger plan_kommentar_vorbereiten
  before insert on public.plan_kommentare
  for each row execute function public.plan_kommentar_vorbereiten();

-- Neue und gelöschte Kommentare melden sich über den Plan-Zähler: offene
-- Pläne laden sie beim nächsten Abgleich nach.
drop trigger if exists aenderung_plan_kommentare on public.plan_kommentare;
create trigger aenderung_plan_kommentare
  after insert or update or delete on public.plan_kommentare
  for each row execute function public.aenderung_zaehlen('plan');

alter table public.plan_kommentare enable row level security;

revoke all on table public.plan_kommentare from anon;
revoke all on table public.plan_kommentare from authenticated;
grant select, insert, delete on table public.plan_kommentare to authenticated;

drop policy if exists "Kommentare lesen" on public.plan_kommentare;
create policy "Kommentare lesen" on public.plan_kommentare
  for select to authenticated
  using (company_id = auth_company_id());

drop policy if exists "Kommentare schreiben" on public.plan_kommentare;
create policy "Kommentare schreiben" on public.plan_kommentare
  for insert to authenticated
  with check (company_id = auth_company_id() and autor_id = auth.uid());

drop policy if exists "Kommentare löschen" on public.plan_kommentare;
create policy "Kommentare löschen" on public.plan_kommentare
  for delete to authenticated
  using (
    company_id = auth_company_id()
    and (autor_id = auth.uid() or is_leadership())
  );
