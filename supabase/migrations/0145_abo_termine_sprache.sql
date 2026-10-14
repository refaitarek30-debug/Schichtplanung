-- 1) Kalender-Abo: eigene Termine aus „Mein Kalender“ (nicht die des
--    Partners). Gleiche Schlüsselprüfung wie abo_plan (0143).
create or replace function public.abo_termine(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid;
  ergebnis jsonb;
begin
  select a.user_id into inhaber
    from kalender_abo a
    join profiles p on p.id = a.user_id and p.active and p.employee_id is not null
   where a.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if inhaber is null or not funktion_frei(inhaber, 'kalender_abo') then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'datum', t.datum,
           'titel', t.titel,
           'ganztaegig', t.ganztaegig,
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'wiederholung', t.wiederholung,
           'notiz', t.notiz,
           'ort', t.ort) order by t.datum), '[]'::jsonb)
    into ergebnis
    from (select * from kalender_termine k
           where k.owner_id = inhaber and not k.von_partner
             and (k.datum >= current_date - 60 or k.wiederholung <> 'nie')
           order by k.datum desc
           limit 500) t;

  return ergebnis;
end;
$$;

revoke all on function public.abo_termine(text) from public;
grant execute on function public.abo_termine(text) to anon, authenticated;

-- 2) Termin per Sprache – zunächst nur für freigeschaltete Personen.
--    Freigabe für alle später:
--      update funktionen set fuer_alle = true where funktion = 'termin_sprache';
insert into public.funktionen (funktion, fuer_alle) values ('termin_sprache', false) on conflict do nothing;
insert into public.funktionen_zugang (funktion, user_id)
values ('termin_sprache', '2a78e4d4-b093-4f55-a485-fd12fe9c1f56') on conflict do nothing;

-- 3) Datenschutzerklärung Fassung 2.4: Termine im Kalender-Abo, Termin per
--    Sprache (Anthropic als Dienstleister).
update public.legal_versions
   set version = '2.4', valid_from = current_date
 where doc = 'datenschutz';
