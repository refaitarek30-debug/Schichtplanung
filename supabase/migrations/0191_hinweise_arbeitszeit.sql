-- Hinweise: „Zur Arbeitszeit“ gilt jetzt auch für das Fenster in der App.
--
-- Bisher kam nur die Handy-Mitteilung erst zur nächsten Schicht – das Fenster
-- erschien schon beim nächsten Öffnen, auch in der Freizeit. Jetzt zeigt die App
-- den Hinweis bei „Zur Arbeitszeit“ erst ab Beginn der nächsten Schicht
-- (naechste_arbeitszeit, wie die Mitteilung).
--
-- Dazu eine Vorgabe je Betrieb (Administration, Regeln): was im Senden-Fenster
-- vorausgewählt ist. Abwärtsverträglich: hinweis_senden behält seine Form.

alter table public.hinweise add column if not exists zeigen_ab timestamptz;

alter table public.company_settings
  add column if not exists hinweis_standard text not null default 'schicht';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_hinweis_standard_check') then
    alter table public.company_settings
      add constraint company_settings_hinweis_standard_check check (hinweis_standard in ('schicht', 'sofort', 'aus'));
  end if;
end $$;

-- ---- Senden: Fenster bei „Zur Arbeitszeit“ erst ab Arbeitsbeginn ---------------------

create or replace function public.hinweis_senden(
  p_empfaenger uuid[],
  p_text text,
  p_ziel text default null,
  p_push text default 'schicht'
) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  ich profiles;
  emp employees;
  neu hinweise;
  konto uuid;
  ab timestamptz;
  anzahl integer := 0;
  text_sauber text := btrim(coalesce(p_text, ''));
begin
  select * into ich from profiles where id = auth.uid() and active;
  if ich.id is null or ich.role not in ('shift_leader', 'admin') then
    raise exception 'Nur Schichtleitung oder Administration dürfen Hinweise schicken.';
  end if;
  if text_sauber = '' then
    raise exception 'Bitte einen Text eingeben.';
  end if;
  if char_length(text_sauber) > 300 then
    raise exception 'Der Hinweis darf höchstens 300 Zeichen lang sein.';
  end if;
  if p_ziel is not null and p_ziel not in ('/urlaub', '/meine-schichten', '/kalender', '/start') then
    raise exception 'Ungültiges Ziel.';
  end if;
  if coalesce(p_push, 'schicht') not in ('schicht', 'sofort', 'aus') then
    raise exception 'Ungültige Auswahl für die Mitteilung.';
  end if;
  if p_empfaenger is null or cardinality(p_empfaenger) = 0 then
    raise exception 'Bitte mindestens eine Person auswählen.';
  end if;
  if cardinality(p_empfaenger) > 200 then
    raise exception 'Höchstens 200 Personen auf einmal.';
  end if;

  delete from hinweise where company_id = ich.company_id and erstellt_am < now() - interval '90 days';

  for emp in select * from employees
              where id = any(p_empfaenger) and company_id = ich.company_id and active loop
    ab := case coalesce(p_push, 'schicht')
            when 'sofort' then now()
            when 'schicht' then naechste_arbeitszeit(emp.id)
            else null end;
    insert into hinweise (company_id, employee_id, von_profile, von_name, text, ziel, push, push_ab, zeigen_ab)
    values (ich.company_id, emp.id, ich.id,
            concat_ws(' ', ich.first_name, ich.last_name),
            text_sauber, p_ziel, coalesce(p_push, 'schicht'), ab,
            case when coalesce(p_push, 'schicht') = 'schicht' then ab end)
    returning * into neu;
    anzahl := anzahl + 1;

    if ab is not null then
      konto := konto_zu_mitarbeiter(emp.id);
      if konto is not null and exists (select 1 from push_abos where user_id = konto) then
        insert into push_warteschlange (user_id, art, titel, text, url, tag, senden_ab)
        values (konto, 'antraege', '💬 Hinweis von ' || coalesce(nullif(neu.von_name, ''), 'deiner Schichtleitung'),
                left(text_sauber, 300), coalesce(p_ziel, '/start'), 'hinweis-' || neu.id::text, ab);
      end if;
    end if;
  end loop;

  if anzahl = 0 then
    raise exception 'Keine der ausgewählten Personen gehört zu deinem Betrieb.';
  end if;
  return anzahl;
end;
$$;
revoke all on function public.hinweis_senden(uuid[], text, text, text) from public, anon;
grant execute on function public.hinweis_senden(uuid[], text, text, text) to authenticated;

-- ---- Empfangen: erst ab zeigen_ab --------------------------------------------------------

create or replace function public.meine_hinweise()
returns table(id uuid, text text, ziel text, von_name text, erstellt_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select h.id, h.text, h.ziel, h.von_name, h.erstellt_am
    from hinweise h
   where h.employee_id = auth_employee_id()
     and h.gelesen_am is null and h.zurueckgezogen_am is null
     and (h.zeigen_ab is null or h.zeigen_ab <= now())
   order by h.erstellt_am
   limit 10
$$;
revoke all on function public.meine_hinweise() from public, anon;
grant execute on function public.meine_hinweise() to authenticated;

-- ---- Vorgabe je Betrieb --------------------------------------------------------------------

create or replace function public.hinweis_standard()
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce((select cs.hinweis_standard from company_settings cs where cs.company_id = auth_company_id()), 'schicht')
$$;
revoke all on function public.hinweis_standard() from public, anon;
grant execute on function public.hinweis_standard() to authenticated;

create or replace function public.set_hinweis_standard(p_wert text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  if p_wert is null or p_wert not in ('schicht', 'sofort', 'aus') then
    raise exception 'Ungültige Auswahl.';
  end if;
  insert into company_settings (company_id, hinweis_standard, updated_at)
  values (v_firma, p_wert, now())
  on conflict (company_id)
    do update set hinweis_standard = excluded.hinweis_standard, updated_at = now();
  perform write_audit(v_firma, 'hinweise.standard', 'company_settings', v_firma,
                      jsonb_build_object('wert', p_wert));
end;
$$;
revoke all on function public.set_hinweis_standard(text) from public, anon;
grant execute on function public.set_hinweis_standard(text) to authenticated;
