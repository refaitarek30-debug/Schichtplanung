-- =============================================================
-- Phase 12 · Benachrichtigungs-Einstellungen + V-Tag Urlaub
--
-- 1. Firmenweite Einstellung, ob bei Urlaubsanträgen eine E-Mail an die
--    Schichtleitung geht (abschaltbar, Standard: an). Die App-Glocke
--    bleibt immer aktiv – die ist kostenlos und stört nicht.
-- 2. Beim Mitarbeiter-Anlegen kann direkt ein Urlaubszeitraum (V-Tage)
--    mitgegeben werden – dafür braucht es keine Schemaänderung, nur eine
--    Hilfsfunktion, die den Antrag direkt genehmigt einträgt.
-- =============================================================

create table if not exists company_settings (
  company_id uuid primary key references companies (id) on delete cascade,
  notify_leave_email boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table company_settings enable row level security;

create policy "Einstellungen lesen" on company_settings
  for select using (company_id = auth_company_id());

create policy "Einstellungen pflegt Admin" on company_settings
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Für jedes bestehende Unternehmen eine Standardzeile anlegen.
insert into company_settings (company_id)
select id from companies
on conflict (company_id) do nothing;

-- Beim Registrieren neuer Unternehmen automatisch eine Zeile mitanlegen.
create or replace function companies_ensure_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into company_settings (company_id) values (new.id)
  on conflict (company_id) do nothing;
  return new;
end;
$$;

drop trigger if exists companies_settings_trg on companies;
create trigger companies_settings_trg
  after insert on companies
  for each row execute function companies_ensure_settings();

-- Einstellung lesen (für die App).
create or replace function get_notification_settings()
returns table (notify_leave_email boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(s.notify_leave_email, true)
  from company_settings s where s.company_id = auth_company_id();
$$;

revoke execute on function get_notification_settings() from public, anon;
grant execute on function get_notification_settings() to authenticated;

-- Einstellung ändern (nur Admin).
create or replace function set_notification_settings(p_notify_leave_email boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Benachrichtigungen einstellen.';
  end if;
  insert into company_settings (company_id, notify_leave_email, updated_at)
  values (auth_company_id(), p_notify_leave_email, now())
  on conflict (company_id)
    do update set notify_leave_email = excluded.notify_leave_email, updated_at = now();
end;
$$;

revoke execute on function set_notification_settings(boolean) from public, anon;
grant execute on function set_notification_settings(boolean) to authenticated;
