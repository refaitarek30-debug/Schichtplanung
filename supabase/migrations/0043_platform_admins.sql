-- =============================================================
-- Phase D · Betreiber-Uebersicht
--
-- Jede Firma sieht ausschliesslich sich selbst -- das ist richtig und
-- bleibt so. Der Betreiber der Plattform braucht daneben eine eigene,
-- streng getrennte Sicht ueber alle Firmen hinweg.
--
-- Warum eine eigene Tabelle und keine weitere Rolle in `profiles`:
-- jede Zeile in `profiles` haengt an genau einer `company_id`. Eine Rolle
-- dort waere damit immer an eine Firma gebunden -- und jede Policy, die
-- sie beruecksichtigt, waere ein Loch in der Mandantentrennung. Der
-- Betreiber steht bewusst *neben* dem Mandantenmodell, nicht darin.
-- =============================================================

create table if not exists platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notiz text,
  created_at timestamptz not null default now()
);

comment on table platform_admins is
  'Betreiber der Plattform. Wird ausschliesslich per SQL gepflegt -- es gibt bewusst keine Oberflaeche, ueber die sich jemand selbst eintragen koennte.';

-- RLS an, aber *keine einzige Policy*. Damit ist die Tabelle ueber die
-- REST-Schnittstelle fuer jeden angemeldeten Nutzer leer -- niemand kann
-- herausfinden, wer Betreiber ist oder ob es die Tabelle ueberhaupt gibt.
-- Der Service-Role-Schluessel umgeht RLS und ist der einzige Weg hinein.
alter table platform_admins enable row level security;

revoke all on table platform_admins from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Ist dieser Benutzer Betreiber?
--
-- Nur fuer service_role. Waere die Funktion fuer `authenticated`
-- freigegeben, koennte jeder Angemeldete durchprobieren, wer Betreiber
-- ist -- und genau das soll die Seite ja verbergen.
-- ---------------------------------------------------------------

create or replace function is_platform_admin(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins a where a.user_id = p_user_id);
$$;

revoke execute on function is_platform_admin(uuid) from public, anon, authenticated;
grant execute on function is_platform_admin(uuid) to service_role;

-- ---------------------------------------------------------------
-- Kennzahlen zum Betrieb der Plattform.
--
-- Bewusst nur Zaehlwerte und Zeitstempel: keine Namen, keine Adressen,
-- keine Urlaubsinhalte, keine Abwesenheitsgruende. Was diese Funktion
-- nicht zurueckgibt, kann die Betreiberseite auch nicht anzeigen -- die
-- Grenze steht hier in der Datenbank und nicht erst in der Oberflaeche.
--
-- `letzte_aktivitaet` ist die juengste Anmeldung eines Kontos dieser
-- Firma. Das ist das ehrlichste Signal dafuer, ob eine Firma die
-- Anwendung tatsaechlich benutzt.
-- ---------------------------------------------------------------

create or replace function platform_overview()
returns table (
  company_id uuid,
  name text,
  angelegt_am timestamptz,
  aktiv boolean,
  avv_akzeptiert_am timestamptz,
  einrichtung_fertig_am timestamptz,
  mitarbeiter_aktiv bigint,
  zugaenge bigint,
  letzte_aktivitaet timestamptz,
  urlaubsantraege bigint,
  offene_antraege bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    c.created_at,
    c.active,
    c.avv_accepted_at,
    c.setup_completed_at,
    (select count(*) from employees e where e.company_id = c.id and e.active),
    (select count(*) from profiles p where p.company_id = c.id and p.active),
    (select max(u.last_sign_in_at) from profiles p
       join auth.users u on u.id = p.id
      where p.company_id = c.id),
    (select count(*) from leave_requests r where r.company_id = c.id),
    (select count(*) from leave_requests r where r.company_id = c.id and r.status = 'pending')
  from companies c
  order by c.created_at;
$$;

revoke execute on function platform_overview() from public, anon, authenticated;
grant execute on function platform_overview() to service_role;
