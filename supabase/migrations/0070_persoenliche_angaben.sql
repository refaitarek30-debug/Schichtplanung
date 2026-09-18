-- 0070 – Persönliche optionale Angaben
-- Geburtsdatum gehört zum persönlichen Bereich und ist freiwillig.
-- Es wird bewusst getrennt von profiles gespeichert, damit Kollegen/Führung
-- es nicht über die normale Profilabfrage erhalten.

begin;

create table if not exists public.personal_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.personal_details is
  'Freiwillige persönliche Angaben; nur die betroffene Person darf sie lesen oder ändern.';
comment on column public.personal_details.birth_date is
  'Freiwilliges Geburtsdatum der eigenen Person.';

alter table public.personal_details enable row level security;
alter table public.personal_details force row level security;

drop policy if exists "personal_details own select" on public.personal_details;
create policy "personal_details own select" on public.personal_details
for select to authenticated
using (user_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "personal_details own insert" on public.personal_details;
create policy "personal_details own insert" on public.personal_details
for insert to authenticated
with check (user_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "personal_details own update" on public.personal_details;
create policy "personal_details own update" on public.personal_details
for update to authenticated
using (user_id = auth.uid() and company_id = auth_company_id())
with check (user_id = auth.uid() and company_id = auth_company_id());

revoke all on public.personal_details from anon;
grant select, insert, update on public.personal_details to authenticated;

create or replace function public.ensure_personal_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.personal_details (user_id, company_id)
  values (new.id, new.company_id)
  on conflict (user_id) do update set company_id = excluded.company_id;
  return new;
end;
$$;

drop trigger if exists trg_profiles_create_personal_details on public.profiles;
create trigger trg_profiles_create_personal_details
after insert on public.profiles
for each row execute function public.ensure_personal_details();

revoke execute on function public.ensure_personal_details() from public, anon, authenticated;
grant execute on function public.ensure_personal_details() to postgres, service_role;

insert into public.personal_details (user_id, company_id)
select p.id, p.company_id
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.personal_details_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.user_id is distinct from auth.uid()
     or new.company_id is distinct from auth_company_id() then
    raise exception 'Du darfst nur deine eigenen persönlichen Angaben ändern.';
  end if;

  new.updated_at := now();

  if new.birth_date is not null
     and new.birth_date > current_date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  end if;

  if new.birth_date is not null
     and new.birth_date < current_date - interval '120 years' then
    raise exception 'Bitte ein gültiges Geburtsdatum eingeben.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_personal_details_guard on public.personal_details;
create trigger trg_personal_details_guard
before insert or update on public.personal_details
for each row execute function public.personal_details_guard();

revoke execute on function public.personal_details_guard() from public, anon, authenticated;
grant execute on function public.personal_details_guard() to postgres, service_role;

commit;
