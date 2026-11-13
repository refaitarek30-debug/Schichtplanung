-- „Meine Daten herunterladen“ (Auskunft und Datenkopie, Art. 15 und 20 DSGVO).
--
-- meine_daten(): alles, was zu der angemeldeten Person gespeichert ist, als
-- eine JSON-Datei – Betrieb und Privatbereich. Nur die eigenen Daten; über
-- andere Personen nur, was die Person in der App ohnehin sieht (z. B. Name
-- der Schichtleitung an einem Hinweis). Ausgelassen werden nur technische
-- Geheimnisse (Prüfwerte von Codes und Links, Schlüssel der Handy-Mitteilungen).
-- Aus dem Änderungsprotokoll: eigene Handlungen und Einträge über die Person,
-- ohne den Namen, wer sie vorgenommen hat (Rechte Dritter, Art. 15 Abs. 4).

create or replace function public.meine_daten()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_emp uuid;
  v_firma uuid;
  v jsonb;
begin
  if v_uid is null then
    raise exception 'Bitte anmelden.' using errcode = '42501';
  end if;
  -- Ohne bestätigten zweiten Faktor oder bei Sperre: keine Herausgabe.
  if not zugang_ok() then
    raise exception 'Bitte zuerst vollständig anmelden.' using errcode = '42501';
  end if;

  select employee_id, company_id into v_emp, v_firma from profiles where id = v_uid;

  v := jsonb_build_object(
    'erstellt_am', now(),
    'hinweis', 'Kopie deiner bei ShiftNexo gespeicherten Daten (Art. 15 und 20 DSGVO). Zeiten in UTC.',
    'konto', (select jsonb_build_object(
                'id', u.id, 'email', u.email, 'angelegt_am', u.created_at,
                'letzte_anmeldung', u.last_sign_in_at, 'email_bestaetigt_am', u.email_confirmed_at,
                'zwei_faktor', (select coalesce(jsonb_agg(jsonb_build_object(
                    'art', f.factor_type, 'status', f.status, 'eingerichtet_am', f.created_at)), '[]'::jsonb)
                  from auth.mfa_factors f where f.user_id = u.id))
              from auth.users u where u.id = v_uid),
    'anmelde_sperre', (select to_jsonb(s) - 'user_id' from anmelde_sperren s where s.user_id = v_uid),

    -- Betrieb
    'profil', (select to_jsonb(p) from profiles p where p.id = v_uid),
    'firma', (select jsonb_build_object('id', c.id, 'name', c.name) from companies c where c.id = v_firma),
    'stammdaten', (select to_jsonb(e) from employees e where e.id = v_emp),
    'geburtsdatum', (select to_jsonb(d) - 'user_id' - 'company_id' from personal_details d where d.user_id = v_uid),
    'datenschutz_einstellungen', (select to_jsonb(x) - 'user_id' from privacy_settings x where x.user_id = v_uid),
    'anzeige_einstellungen', (select to_jsonb(x) - 'user_id' from anzeige_einstellungen x where x.user_id = v_uid),
    'qualifikationen', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id') from employee_qualifications x where x.employee_id = v_emp), '[]'::jsonb),
    'schichtplan', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' order by x.date) from shift_assignments x where x.employee_id = v_emp), '[]'::jsonb),
    'urlaubsantraege', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from leave_requests x where x.employee_id = v_emp), '[]'::jsonb),
    'abwesenheiten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from absences x where x.employee_id = v_emp), '[]'::jsonb),
    'urlaubskonten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from leave_balances x where x.employee_id = v_emp), '[]'::jsonb),
    'altersfreizeit', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from age_leave_grants x where x.employee_id = v_emp), '[]'::jsonb),
    'fehlzeiten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from fehlzeiten x where x.employee_id = v_emp), '[]'::jsonb),
    'ausbildung', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from training_assignments x where x.employee_id = v_emp), '[]'::jsonb),
    'plan_kommentare', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' - 'autor_id') from plan_kommentare x where x.employee_id = v_emp), '[]'::jsonb),
    'vertretungsanfragen', coalesce((select jsonb_agg(to_jsonb(x) - 'company_id') from replacement_requests x
                                     where x.absent_employee_id = v_emp or x.asked_employee_id = v_emp), '[]'::jsonb),
    'benachrichtigungen', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from notifications x where x.employee_id = v_emp), '[]'::jsonb),
    'hinweise_an_mich', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' - 'von_profile') from hinweise x where x.employee_id = v_emp), '[]'::jsonb),
    'aenderungsprotokoll', coalesce((
      select jsonb_agg(jsonb_build_object(
               'zeit', l.created_at, 'aktion', l.action, 'bereich', l.entity,
               'von_mir', l.actor_id = v_uid, 'details', l.payload) order by l.created_at)
        from audit_logs l
       where l.company_id = v_firma
         and (l.actor_id = v_uid
              or l.entity_id in (v_uid, v_emp)
              or (v_emp is not null and l.payload ->> 'employee_id' = v_emp::text))), '[]'::jsonb),

    -- Privatbereich und Mein Kalender
    'privat_konto', (select to_jsonb(x) - 'user_id' from privat_konten x where x.user_id = v_uid),
    'privat_schichtarten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from privat_schichtarten x where x.user_id = v_uid), '[]'::jsonb),
    'privat_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.tag) from privat_tage x where x.user_id = v_uid), '[]'::jsonb),
    'privat_tag_zeiten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from privat_tag_zeiten x where x.user_id = v_uid), '[]'::jsonb),
    'privat_umfrage', (select to_jsonb(x) - 'user_id' from privat_umfrage x where x.user_id = v_uid),
    'lohnabrechnungen', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'pfad') from privat_lohnzettel x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_termine', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id' order by x.datum) from kalender_termine x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_termin_ausnahmen', coalesce((select jsonb_agg(to_jsonb(a)) from kalender_termin_ausnahmen a
                                          join kalender_termine t on t.id = a.termin_id where t.owner_id = v_uid), '[]'::jsonb),
    'kalender_todos', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_todos x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_eigene_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_eigene_tage x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_eigene_arten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_eigene_arten x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_farben', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_farben x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_vorlieben', (select to_jsonb(x) - 'user_id' from kalender_vorlieben x where x.user_id = v_uid),
    'kalender_personen', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_personen x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_personen_tage', coalesce((select jsonb_agg(to_jsonb(t)) from kalender_personen_tage t
                                       join kalender_personen p on p.id = t.person_id where p.owner_id = v_uid), '[]'::jsonb),
    'kalender_partner_links', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id' - 'token_hash') from kalender_partner x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_partner_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_partner_tage x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_verbindungen', coalesce((select jsonb_agg(to_jsonb(x)) from kalender_verbindungen x where v_uid in (x.a, x.b)), '[]'::jsonb),
    'kalender_gruppen', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'beigetreten_am', m.beigetreten_am,
                                    'selbst_erstellt', g.erstellt_von = v_uid))
                                  from kalender_gruppen_mitglieder m join kalender_gruppen g on g.id = m.gruppe_id
                                 where m.user_id = v_uid), '[]'::jsonb),
    'kalender_abo', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'token_hash') from kalender_abo x where x.user_id = v_uid), '[]'::jsonb),

    -- Handy-Mitteilungen (ohne die technischen Schlüssel)
    'handy_mitteilungen_geraete', coalesce((select jsonb_agg(jsonb_build_object('geraet', x.geraet, 'erstellt_am', x.erstellt_am))
                                           from push_abos x where x.user_id = v_uid), '[]'::jsonb),
    'handy_mitteilungen_einstellungen', (select to_jsonb(x) - 'user_id' from push_vorlieben x where x.user_id = v_uid)
  );

  return v;
end;
$$;

revoke all on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;

-- Datenschutzerklärung 2.34: Datenkopie zum Herunterladen.
update public.legal_versions set version = '2.34', valid_from = current_date where doc = 'datenschutz';
-- AV-Vertrag 1.5: § 8 (TOM) aktualisiert – Zwei-Faktor, Sperre, eigene Sicherung, Betreiber.
update public.legal_versions set version = '1.5', valid_from = current_date where doc = 'avv';
