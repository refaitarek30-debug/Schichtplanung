-- Datenschutz und Robustheit (10.11.2026), Funde S-04, D-06, D-07, D-11, L-02 aus docs/review/.
--
-- 1) Mail „Neuer Antrag“ ohne persönliche Inhalte: kein Name, kein Zeitraum, kein Kommentar –
--    nur ein Hinweis, die App zu öffnen. So liegen keine Urlaubsdaten in Postfächern und beim
--    Mail-Dienst, und es lässt sich kein Text (Links, HTML) in die Mail einschleusen.
--    Die Benachrichtigung in der App (Glocke) bleibt mit Inhalt, geht aber nur noch an die
--    Zuständigen: Administration und die Schichtleitung der Gruppe (wie bisher die Mail).
--
-- 2) Keine Gesundheitsangaben in Freitexten: Kommentar zum Antrag, Ablehnungs- und
--    Rücknahmegrund, Notiz zur Abwesenheit, Fehlzeit-Notiz, Kommentar im Plan.
--    Geprüft wird nur, wenn der Text neu ist oder sich ändert – alte Einträge bleiben.
--
-- 3) Sperre je Person beim Prüfen auf überlappende Anträge: Zwei gleichzeitige Anträge
--    (Doppeltipp, zwei Geräte) können sich nicht mehr gegenseitig übersehen.

-- 1) -----------------------------------------------------------------------------------------
create or replace function public.notify_leave_submitted(
  p_company_id uuid,
  p_employee_id uuid,
  p_request_id uuid,
  p_antragsteller text,
  p_gruppe rotation_team,
  p_art text,
  p_von date,
  p_bis date,
  p_tage numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  zeitraum text;
  per_mail boolean;
begin
  zeitraum := case
    when p_von = p_bis then to_char(p_von, 'DD.MM.YYYY')
    else to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;

  -- Glocke in der App: nur an die Zuständigen.
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    p_company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || p_art,
    p_antragsteller || ' hat ' || p_art || ' beantragt: ' || zeitraum || '.',
    'leave_requests', p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe))
    );

  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = p_company_id;
  if not coalesce(per_mail, true) then
    return;
  end if;

  -- Mail: nur ein Hinweis, keine Inhalte.
  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    p_company_id,
    p.email,
    'Neuer Antrag in ShiftNexo',
    'Hallo,' || chr(10) || chr(10) ||
      'in ShiftNexo wartet ein neuer Antrag auf deine Entscheidung.' || chr(10) ||
      'Bitte öffne die App: https://shiftnexo.de/urlaub' || chr(10) || chr(10) ||
      'Aus Datenschutzgründen stehen keine Einzelheiten in dieser E-Mail.',
    '<p>Hallo,</p>' ||
      '<p>in ShiftNexo wartet ein neuer Antrag auf deine Entscheidung.</p>' ||
      '<p><a href="https://shiftnexo.de/urlaub">ShiftNexo öffnen</a></p>' ||
      '<p style="color:#6b7280;font-size:12px">Aus Datenschutzgründen stehen keine Einzelheiten in dieser E-Mail.</p>',
    'urlaubsantrag',
    p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe))
    );
end;
$function$;

-- 2) -----------------------------------------------------------------------------------------
-- true, wenn der Text nach Gesundheitsangaben aussieht (ganze Wörter, Groß-/Kleinschreibung egal).
create or replace function public.enthaelt_gesundheitsangabe(p_text text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_text, '') ~* (
    '\m(krank\w*|arzt\w*|ärzt\w*|zahnarzt\w*|hausarzt\w*|facharzt\w*|diagnose\w*|therapie\w*|operation\w*|'
    || 'krankenhaus\w*|klinik\w*|reha\w*|kur|schwanger\w*|attest\w*|depression\w*|burn-?out|psych\w*|'
    || 'physio\w*|chemo\w*|krebs\w*|infektion\w*|corona|covid\w*|grippe\w*|op|au-bescheinigung\w*)\M'
  );
$$;

create or replace function public.freitext_ohne_gesundheit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  feld text;
  neu text;
  alt text;
begin
  foreach feld in array tg_argv loop
    neu := to_jsonb(new) ->> feld;
    alt := case when tg_op = 'UPDATE' then to_jsonb(old) ->> feld end;
    if neu is distinct from alt and enthaelt_gesundheitsangabe(neu) then
      raise exception 'Bitte keine Gesundheitsangaben (z. B. Arzt, Krankheit, Therapie) in Kommentare schreiben. Für Krankheit gibt es die Abwesenheit „krank“ ohne Text.';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.freitext_ohne_gesundheit() from public, anon, authenticated;

drop trigger if exists freitext_ohne_gesundheit on public.leave_requests;
create trigger freitext_ohne_gesundheit
  before insert or update on public.leave_requests
  for each row execute function public.freitext_ohne_gesundheit('reason', 'rejection_reason', 'withdrawal_reason');

drop trigger if exists freitext_ohne_gesundheit on public.absences;
create trigger freitext_ohne_gesundheit
  before insert or update on public.absences
  for each row execute function public.freitext_ohne_gesundheit('note');

drop trigger if exists freitext_ohne_gesundheit on public.fehlzeiten;
create trigger freitext_ohne_gesundheit
  before insert or update on public.fehlzeiten
  for each row execute function public.freitext_ohne_gesundheit('notiz');

drop trigger if exists freitext_ohne_gesundheit on public.plan_kommentare;
create trigger freitext_ohne_gesundheit
  before insert or update on public.plan_kommentare
  for each row execute function public.freitext_ohne_gesundheit('text');

-- 3) -----------------------------------------------------------------------------------------
create or replace function public.leave_requests_check_overlap()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  kollision leave_requests;
begin
  if new.status not in ('approved', 'pending') then
    return new;
  end if;

  -- Gleichzeitige Anträge derselben Person nacheinander prüfen (bis zum Ende der Transaktion).
  perform pg_advisory_xact_lock(hashtextextended('urlaub:' || new.employee_id::text, 0));

  select * into kollision
  from leave_requests r
  where r.employee_id = new.employee_id
    and r.id is distinct from new.id
    and r.status in ('approved', 'pending')
    and r.start_date <= new.end_date
    and r.end_date >= new.start_date
    and not (
      new.start_date = new.end_date
      and r.start_date = r.end_date
      and new.half_day_period is not null
      and r.half_day_period is not null
      and r.half_day_period is distinct from new.half_day_period
    )
  order by r.start_date
  limit 1;

  if kollision.id is not null then
    raise exception 'Für % bis % liegt bereits ein Antrag vor (% bis %, %). Bitte zuerst den bestehenden Antrag zurückziehen.',
      to_char(new.start_date, 'DD.MM.YYYY'),
      to_char(new.end_date, 'DD.MM.YYYY'),
      to_char(kollision.start_date, 'DD.MM.YYYY'),
      to_char(kollision.end_date, 'DD.MM.YYYY'),
      case kollision.status::text when 'approved' then 'genehmigt' else 'offen' end;
  end if;
  return new;
end;
$$;
