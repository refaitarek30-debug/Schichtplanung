-- =============================================================
-- Phase B · E-Mail bei neuen Urlaubsantraegen
--
-- In den Einstellungen steht seit 0020 ein Schalter "E-Mail bei neuem
-- Urlaubsantrag" -- verschickt wurde aber nie eine. Die Einstellung war
-- ein Versprechen, das die Anwendung nicht gehalten hat.
--
-- Warum ein Postausgang und kein Versand direkt im Trigger:
-- Ein Trigger laeuft in derselben Transaktion wie der Urlaubsantrag. Ein
-- ausgehender HTTP-Aufruf darin haengt den Antrag an die Erreichbarkeit
-- des Mailservers -- ist der langsam oder weg, scheitert das Beantragen
-- von Urlaub. Deshalb schreibt der Trigger nur eine Zeile (schnell,
-- transaktional, kann nicht scheitern), und eine Edge Function raeumt den
-- Postausgang spaeter ab.
--
-- Nebeneffekt, der genauso wichtig ist: solange kein eigener SMTP-Versand
-- eingerichtet ist, sammeln sich die Zeilen sichtbar an, statt lautlos
-- verloren zu gehen. Die Einstellungsseite zeigt das an.
-- =============================================================

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  empfaenger text not null,
  betreff text not null,
  text_teil text not null,
  html_teil text not null,
  -- Wozu die Mail gehoert, damit man spaeter filtern kann.
  anlass text not null,
  related_id uuid,
  status text not null default 'offen' check (status in ('offen', 'gesendet', 'fehler')),
  versuche int not null default 0,
  letzter_fehler text,
  gesendet_at timestamptz,
  created_at timestamptz not null default now()
);

-- Der Abholindex: die Edge Function fragt immer nur nach offenen Zeilen.
create index if not exists email_outbox_offen_idx
  on email_outbox (created_at) where status = 'offen';
create index if not exists email_outbox_company_idx
  on email_outbox (company_id, created_at desc);

alter table email_outbox enable row level security;

-- Lesen darf nur die Administration des eigenen Unternehmens -- in den
-- Zeilen stehen Namen und Adressen von Beschaeftigten. Schreiben darf
-- niemand ueber die Schnittstelle: die Zeilen entstehen ausschliesslich im
-- Trigger, abgeraeumt werden sie von der Edge Function mit dem
-- Service-Role-Schluessel, der RLS ohnehin umgeht.
drop policy if exists "Postausgang liest Admin" on email_outbox;
create policy "Postausgang liest Admin" on email_outbox
  for select using (company_id = auth_company_id() and is_admin());

revoke all on table email_outbox from public, anon;
grant select on table email_outbox to authenticated;

-- ---------------------------------------------------------------
-- Der Trigger schreibt jetzt zusaetzlich zur Glocke in den Postausgang.
-- ---------------------------------------------------------------

create or replace function leave_requests_notify_leadership()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  antragsteller text;
  firma text;
  zeitraum text;
  tage text;
  art text;
  per_mail boolean;
  gruppe rotation_team;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select e.first_name || ' ' || e.last_name, e.rotation_team
    into antragsteller, gruppe
    from employees e where e.id = new.employee_id;

  -- Glocke in der Anwendung: geht immer, kostet nichts, stoert nicht.
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    new.company_id, p.employee_id,
    'leave_submitted', 'Neuer Urlaubsantrag',
    antragsteller || ' hat Urlaub beantragt.',
    'leave_requests', new.id
  from profiles p
  where p.company_id = new.company_id
    and p.role in ('shift_leader', 'admin')
    and p.employee_id is not null;

  -- E-Mail nur, wenn das Unternehmen sie eingeschaltet hat.
  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = new.company_id;
  if not coalesce(per_mail, true) then
    return new;
  end if;

  select c.name into firma from companies c where c.id = new.company_id;

  zeitraum := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD.MM.YYYY')
    else to_char(new.start_date, 'DD.MM.YYYY') || ' bis ' || to_char(new.end_date, 'DD.MM.YYYY')
  end;

  -- Ganze Tage ohne Nachkommastelle, halbe mit deutschem Komma.
  tage := case
    when new.requested_days = trunc(new.requested_days)
      then trunc(new.requested_days)::text
    else replace(to_char(new.requested_days, 'FM9990D0'), '.', ',')
  end;

  art := case new.kind when 'v_tag' then 'V-Tag' else 'Urlaub' end;

  -- Anders als die Glocke geht die Mail nur an die *zustaendige*
  -- Schichtleitung: die der eigenen Rotationsgruppe, dazu die
  -- Administration. Sonst bekaemen bei vier Schichten alle acht
  -- Schichtleiter jeden Antrag -- nach einer Woche liest das niemand mehr.
  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    new.company_id,
    p.email,
    'Neuer Urlaubsantrag: ' || antragsteller,
    'Hallo ' || coalesce(p.first_name, '') || ',' || chr(10) || chr(10) ||
      antragsteller || ' hat ' || art || ' beantragt.' || chr(10) ||
      'Zeitraum: ' || zeitraum || chr(10) ||
      'Tage: ' || tage || chr(10) ||
      coalesce('Kommentar: ' || nullif(trim(new.reason), '') || chr(10), '') || chr(10) ||
      'Der Antrag liegt im Schichtplan zur Entscheidung bereit.' || chr(10) || chr(10) ||
      firma || ' · Schichtplan',
    '<p>Hallo ' || coalesce(p.first_name, '') || ',</p>' ||
      '<p><strong>' || antragsteller || '</strong> hat ' || art || ' beantragt.</p>' ||
      '<ul>' ||
      '<li>Zeitraum: ' || zeitraum || '</li>' ||
      '<li>Tage: ' || tage || '</li>' ||
      coalesce('<li>Kommentar: ' || nullif(trim(new.reason), '') || '</li>', '') ||
      '</ul>' ||
      '<p>Der Antrag liegt im Schichtplan zur Entscheidung bereit.</p>' ||
      '<p style="color:#6b7280;font-size:12px">' || firma || ' · Schichtplan</p>',
    'urlaubsantrag',
    new.id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = new.company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    -- Nicht an sich selbst: wer den Antrag stellt, weiss davon.
    and p.employee_id is distinct from new.employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (gruppe is null or pe.rotation_team is null or pe.rotation_team = gruppe))
    );

  return new;
end;
$$;

revoke execute on function leave_requests_notify_leadership() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Stand des Postausgangs fuer die Einstellungsseite.
--
-- Damit laesst sich die Frage "laeuft der Mailversand?" beantworten, ohne
-- dass die Anwendung die SMTP-Konfiguration von Supabase kennen muesste --
-- die ist ueber die Schnittstelle nicht abfragbar. Stauen sich offene
-- Zeilen, ist der Versand nicht eingerichtet.
-- ---------------------------------------------------------------

create or replace function email_outbox_status()
returns table (offen bigint, gesendet bigint, fehler bigint,
               letzter_versand timestamptz, letzter_fehler text)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where o.status = 'offen'),
    count(*) filter (where o.status = 'gesendet'),
    count(*) filter (where o.status = 'fehler'),
    max(o.gesendet_at),
    (select o2.letzter_fehler from email_outbox o2
      where o2.company_id = auth_company_id() and o2.status = 'fehler'
      order by o2.created_at desc limit 1)
  from email_outbox o
  where o.company_id = auth_company_id() and is_admin();
$$;

revoke execute on function email_outbox_status() from public, anon;
grant execute on function email_outbox_status() to authenticated;
