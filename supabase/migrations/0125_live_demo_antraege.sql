-- Live-Demo: Beispielanträge übernehmen.
--
-- In 0124 wurden die Urlaubsanträge der Vorlage beim Anlegen einer Demo
-- verworfen: die Tagesberechnung (is_planned_workday) braucht einen
-- angemeldeten Kontext im Mandanten, die Dienstrolle hat keinen. Jetzt
-- entsteht die Demo-Person zuerst, und die Anträge werden in ihrem Namen
-- angelegt. Sonst unverändert.

create or replace function public.demo_create(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cfg demo_settings;
  tmpl companies;
  v_company uuid;
  v_admin_emp uuid;
  v_email text;
  v_delta int;
  v_claims text;
  m_shift jsonb := '{}';
  m_qual jsonb := '{}';
  m_pat jsonb := '{}';
  m_emp jsonb := '{}';
  r record;
  v_new uuid;
  jahr int := extract(year from current_date)::int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Nicht erlaubt.';
  end if;

  select * into cfg from demo_settings where id;
  select * into tmpl from companies where id = cfg.template_company_id;
  if tmpl.id is null then
    raise exception 'Die Live-Demo ist gerade nicht verfügbar.';
  end if;

  if (select count(*) from companies where is_demo and demo_expires_at > now()) >= cfg.max_active then
    raise exception 'Gerade sind sehr viele Demos aktiv. Bitte versuche es später erneut.';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'Konto nicht gefunden.';
  end if;
  if exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Zu diesem Konto gehört bereits ein Unternehmen.';
  end if;

  -- Termine der Vorlage wandern mit: um ganze Wochen verschoben, damit
  -- Wochentage und Rotation zusammenpassen.
  v_delta := ((current_date - tmpl.created_at::date) / 7) * 7;

  -- Beispieldaten erzeugen keine „Neuer Antrag“-Mitteilungen.
  perform set_config('schichtplan.sammelantrag', 'an', true);

  insert into companies (name, is_demo, demo_expires_at, setup_completed_at, active)
  values (tmpl.name || ' (Demo)', true, now() + cfg.lifetime, now(), true)
  returning id into v_company;

  update company_settings cs
     set state = t.state,
         work_on_holidays = t.work_on_holidays,
         gruende_fuer_kollegen = t.gruende_fuer_kollegen,
         notify_leave_email = false
    from company_settings t
   where cs.company_id = v_company and t.company_id = tmpl.id;

  for r in select * from shifts where company_id = tmpl.id loop
    insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays, active)
    values (v_company, r.name, r.short_name, r.start_time, r.end_time, r.color, r.minimum_staff, r.target_staff, r.weekdays, r.active)
    returning id into v_new;
    m_shift := m_shift || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from qualifications where company_id = tmpl.id loop
    insert into qualifications (company_id, key, label, active, sort_order)
    values (v_company, r.key, r.label, r.active, r.sort_order)
    returning id into v_new;
    m_qual := m_qual || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from rotation_patterns where company_id = tmpl.id loop
    insert into rotation_patterns (company_id, name, anchor_date, steps, active, team_offset_days)
    values (
      v_company, r.name, r.anchor_date,
      coalesce((
        select jsonb_agg(
                 case when s ->> 'shift' is null then s
                      else jsonb_set(s, '{shift}', coalesce(m_shift -> (s ->> 'shift'), 'null'::jsonb)) end
                 order by o)
          from jsonb_array_elements(r.steps) with ordinality as e(s, o)
      ), '[]'::jsonb),
      r.active, r.team_offset_days)
    returning id into v_new;
    m_pat := m_pat || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from employees where company_id = tmpl.id loop
    insert into employees (
      company_id, personnel_number, first_name, last_name, email, phone, role, department,
      shift_id, vacation_days, active, rotation_pattern_id, qualifications, rotation_team,
      v_days, shift_worker, sort_order, profile_confirmed_at, entry_date, exit_date,
      is_apprentice, bildungsurlaub_erlaubt, af_ab, sonderurlaub_erlaubt, af_start_stunden,
      v_ab, v_start_stunden
    ) values (
      v_company, r.personnel_number, r.first_name, r.last_name, null, null, r.role, r.department,
      (m_shift ->> r.shift_id::text)::uuid, r.vacation_days, r.active,
      (m_pat ->> r.rotation_pattern_id::text)::uuid, r.qualifications, r.rotation_team,
      r.v_days, r.shift_worker, r.sort_order, r.profile_confirmed_at, r.entry_date, r.exit_date,
      r.is_apprentice, r.bildungsurlaub_erlaubt, r.af_ab, r.sonderurlaub_erlaubt, r.af_start_stunden,
      r.v_ab, r.v_start_stunden
    )
    returning id into v_new;
    m_emp := m_emp || jsonb_build_object(r.id::text, v_new);
  end loop;

  insert into employee_qualifications (employee_id, qualification_id)
  select (m_emp ->> eq.employee_id::text)::uuid, (m_qual ->> eq.qualification_id::text)::uuid
    from employee_qualifications eq
    join employees e on e.id = eq.employee_id and e.company_id = tmpl.id
  on conflict do nothing;

  insert into shift_qualification_needs (company_id, shift_id, qualification_id, minimum)
  select v_company, (m_shift ->> n.shift_id::text)::uuid, (m_qual ->> n.qualification_id::text)::uuid, n.minimum
    from shift_qualification_needs n where n.company_id = tmpl.id
  on conflict do nothing;

  insert into leave_balances (company_id, employee_id, year, entitlement, carried_over, v_entitlement, v_carried_over, v_korrektur)
  select v_company, (m_emp ->> b.employee_id::text)::uuid, b.year, b.entitlement, b.carried_over,
         b.v_entitlement, b.v_carried_over, b.v_korrektur
    from leave_balances b where b.company_id = tmpl.id
  on conflict (employee_id, year) do update
     set entitlement = excluded.entitlement,
         carried_over = excluded.carried_over,
         v_entitlement = excluded.v_entitlement,
         v_carried_over = excluded.v_carried_over,
         v_korrektur = excluded.v_korrektur;

  perform ensure_holidays(v_company, jahr, false);
  perform ensure_holidays(v_company, jahr + 1, false);

  -- Die Person am Bildschirm: Administration, damit alles sichtbar ist.
  insert into employees (company_id, personnel_number, first_name, last_name, role, vacation_days, v_days,
                         shift_worker, profile_confirmed_at)
  values (v_company, 'DEMO', 'Demo', 'Administration', 'admin', 0, 0, false, now())
  returning id into v_admin_emp;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (p_user_id, v_company, v_admin_emp, 'Demo', 'Administration', v_email, 'admin');

  -- Keine Datenschutz-Abfrage: es gibt keine echten Beschäftigtendaten.
  update privacy_settings
     set accepted_at = now(),
         privacy_notice_version = coalesce(current_legal_version('datenschutz'), privacy_notice_version)
   where user_id = p_user_id;

  -- Anträge rechnen mit eingeplanten Arbeitstagen (is_planned_workday), und
  -- die brauchen einen angemeldeten Kontext im Mandanten. Deshalb laufen sie
  -- als die neue Demo-Person; danach wieder als Dienstrolle.
  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);

  -- Anträge einzeln: scheitert ein Beispielantrag an einer Regel, fehlt er
  -- eben in der Demo – die Demo selbst entsteht trotzdem.
  for r in select * from leave_requests where company_id = tmpl.id and status in ('approved', 'pending', 'rejected') loop
    begin
      insert into leave_requests (
        company_id, employee_id, start_date, end_date, half_day, requested_days, reason, status,
        reviewed_at, rejection_reason, half_day_period, kind
      ) values (
        v_company, (m_emp ->> r.employee_id::text)::uuid, r.start_date + v_delta, r.end_date + v_delta,
        r.half_day, r.requested_days, r.reason, r.status,
        case when r.reviewed_at is null then null else r.reviewed_at + make_interval(days => v_delta) end,
        r.rejection_reason, r.half_day_period, r.kind
      );
    exception when others then
      null;
    end;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);

  insert into absences (company_id, employee_id, date, type, note)
  select v_company, (m_emp ->> a.employee_id::text)::uuid, a.date + v_delta, a.type,
         case when a.type = 'krank' then null else a.note end
    from absences a where a.company_id = tmpl.id
  on conflict do nothing;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  select v_company, (m_emp ->> s.employee_id::text)::uuid, (m_shift ->> s.shift_id::text)::uuid, s.date + v_delta
    from shift_assignments s where s.company_id = tmpl.id
  on conflict do nothing;

  insert into announcements (company_id, title, body, level, active)
  select v_company, a.title, a.body, a.level, a.active
    from announcements a where a.company_id = tmpl.id;

  -- Regeln zuletzt: eine Urlaubssperre würde sonst schon die Beispielanträge abweisen.
  insert into staffing_rules (company_id, shift_id, key, value, active)
  select v_company, (m_shift ->> s.shift_id::text)::uuid, s.key,
         case when s.key = 'urlaubssperre' and s.value ? 'start' and s.value ? 'end'
              then s.value
                   || jsonb_build_object('start', ((s.value ->> 'start')::date + v_delta)::text)
                   || jsonb_build_object('end', ((s.value ->> 'end')::date + v_delta)::text)
              else s.value end,
         s.active
    from staffing_rules s where s.company_id = tmpl.id
  on conflict do nothing;

  return v_company;
end;
$$;

revoke all on function public.demo_create(uuid) from public, anon, authenticated;
grant execute on function public.demo_create(uuid) to service_role;
