-- =============================================================
-- 0241 · Privatbereich: Erinnerung an die eigene Schicht + Datenschutz 2.44
--
-- Wer will, bekommt eine Mitteilung aufs Handy:
--   * 'vortag18' – am Abend vorher um 18 Uhr („Morgen: Früh · 06:00–14:00“)
--   * 'stunde1'  – 1 Stunde vor Beginn (nur Schichten mit Uhrzeit)
-- Gezählt werden nur Arbeitsschichten (nicht Frei, Urlaub, Krank).
--
-- Alle 10 Minuten reiht schicht_erinnerungen_einreihen() fällige Erinnerungen
-- in die bestehende Warteschlange ein (mit senden_ab). Den Versand übernimmt
-- der bekannte Weg (erinnerungen_anstossen → /api/erinnerungen). Jede
-- Erinnerung geht genau einmal raus (erinnerung_gesendet, nach 3 Tagen weg).
-- „Ohne Inhalt anzeigen“ gilt wie für alle Mitteilungen der Warteschlange.
-- =============================================================

alter table public.privat_konten
  add column if not exists schicht_erinnerung text
  check (schicht_erinnerung in ('vortag18', 'stunde1'));

-- Die Person stellt es selbst ein (wie Name, Bundesland usw.).
grant update (schicht_erinnerung) on public.privat_konten to authenticated;

alter table public.push_warteschlange drop constraint if exists push_warteschlange_art_check;
alter table public.push_warteschlange add constraint push_warteschlange_art_check
  check (art in ('antraege', 'plan', 'einspringen', 'teilen', 'schicht'));

create or replace function public.schicht_erinnerungen_einreihen()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  n integer;
begin
  with schichten as (
    select k.user_id, k.schicht_erinnerung as wie, t.tag, s.name, s.reihenfolge,
           coalesce(z.beginn, s.beginn) as beginn, coalesce(z.ende, s.ende) as ende
      from privat_konten k
      join privat_tage t on t.user_id = k.user_id and t.tag between v_heute and v_heute + 1
      join privat_schichtarten s on s.user_id = t.user_id and s.id = t.schichtart_id and s.art = 'arbeit'
      left join privat_tag_zeiten z on z.user_id = t.user_id and z.tag = t.tag and z.schichtart_id = t.schichtart_id
     where k.schicht_erinnerung is not null
       and exists (select 1 from push_abos p where p.user_id = k.user_id)
  ),
  je_tag as (
    select user_id, wie, tag,
           string_agg(name, ' + ' order by beginn nulls last, reihenfolge) as namen,
           min(beginn) as erster,
           string_agg(case when beginn is not null and ende is not null
                           then to_char(beginn, 'HH24:MI') || '–' || to_char(ende, 'HH24:MI') end,
                      ' · ' order by beginn) as zeiten
      from schichten
     group by user_id, wie, tag
  ),
  faellig as (
    select j.*,
           case j.wie
             when 'vortag18' then ((j.tag - 1) + time '18:00') at time zone 'Europe/Berlin'
             else ((j.tag + j.erster) - interval '1 hour') at time zone 'Europe/Berlin'
           end as wann
      from je_tag j
     where j.wie = 'vortag18' or j.erster is not null
  ),
  neu as (
    insert into erinnerung_gesendet (art, ref_id, faellig_am)
    select 'schicht', f.user_id, f.wann
      from faellig f
     where f.wann between now() - interval '10 minutes' and now() + interval '20 minutes'
    on conflict do nothing
    returning ref_id, faellig_am
  )
  insert into push_warteschlange (user_id, art, titel, text, url, tag, senden_ab)
  select f.user_id, 'schicht',
         case f.wie when 'vortag18' then 'Morgen: ' else 'In 1 Stunde: ' end || f.namen,
         coalesce(f.zeiten, 'Ganzer Tag'),
         '/privat',
         'schicht-' || f.tag,
         greatest(f.wann, now())
    from faellig f
    join neu on neu.ref_id = f.user_id and neu.faellig_am = f.wann;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.schicht_erinnerungen_einreihen() from public, anon, authenticated;

select cron.unschedule('schicht-erinnerungen') where exists (select 1 from cron.job where jobname = 'schicht-erinnerungen');
select cron.schedule('schicht-erinnerungen', '*/10 * * * *', $$select public.schicht_erinnerungen_einreihen()$$);

update public.legal_versions set version = '2.44', valid_from = current_date where doc = 'datenschutz';
