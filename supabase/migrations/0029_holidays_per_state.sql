-- =============================================================
-- Phase 12c · Feiertage automatisch, je Bundesland
--
-- FEHLER: In holidays standen nur elf Tage für 2027, und die nur bei
-- einer Firma. Für das laufende Jahr gab es keine. Die Regel "Feiertage
-- kosten keinen Urlaub" lief damit ins Leere, und eine neu registrierte
-- Firma bekam überhaupt keine Feiertage.
--
-- Jetzt rechnet die Datenbank sie aus – inklusive der beweglichen Termine
-- rund um Ostern – und zwar für das Bundesland, das die Firma einstellt.
-- =============================================================

alter table company_settings
  add column if not exists state text not null default 'NW';

-- Ostersonntag nach der Gauß-Formel. Grundlage für Karfreitag,
-- Ostermontag, Christi Himmelfahrt, Pfingsten und Fronleichnam.
create or replace function easter_sunday(p_year int)
returns date language plpgsql immutable as $$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int; monat int; tag int;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  monat := (h + l - 7 * m + 114) / 31;
  tag := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, monat, tag);
end;
$$;

-- Gesetzliche Feiertage eines Jahres für ein Bundesland.
-- Kürzel nach ISO: BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH
create or replace function german_holidays(p_year int, p_state text)
returns table (tag date, bezeichnung text)
language plpgsql immutable as $$
declare
  ostern date := easter_sunday(p_year);
  bl text := upper(coalesce(p_state, 'NW'));
begin
  -- Bundesweit
  return query values
    (make_date(p_year, 1, 1),   'Neujahr'),
    (ostern - 2,                'Karfreitag'),
    (ostern + 1,                'Ostermontag'),
    (make_date(p_year, 5, 1),   'Tag der Arbeit'),
    (ostern + 39,               'Christi Himmelfahrt'),
    (ostern + 50,               'Pfingstmontag'),
    (make_date(p_year, 10, 3),  'Tag der Deutschen Einheit'),
    (make_date(p_year, 12, 25), '1. Weihnachtstag'),
    (make_date(p_year, 12, 26), '2. Weihnachtstag');

  if bl in ('BW', 'BY', 'ST') then
    return query values (make_date(p_year, 1, 6), 'Heilige Drei Könige');
  end if;

  if bl in ('BE', 'MV') then
    return query values (make_date(p_year, 3, 8), 'Internationaler Frauentag');
  end if;

  if bl = 'BB' then
    return query values (ostern, 'Ostersonntag'), (ostern + 49, 'Pfingstsonntag');
  end if;

  if bl in ('BW', 'BY', 'HE', 'NW', 'RP', 'SL') then
    return query values (ostern + 60, 'Fronleichnam');
  end if;

  if bl = 'SL' then
    return query values (make_date(p_year, 8, 15), 'Mariä Himmelfahrt');
  end if;

  if bl = 'TH' then
    return query values (make_date(p_year, 9, 20), 'Weltkindertag');
  end if;

  if bl in ('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH') then
    return query values (make_date(p_year, 10, 31), 'Reformationstag');
  end if;

  if bl in ('BW', 'BY', 'NW', 'RP', 'SL') then
    return query values (make_date(p_year, 11, 1), 'Allerheiligen');
  end if;

  if bl = 'SN' then
    -- Buß- und Bettag: der Mittwoch vor dem 23. November.
    return query
      select d::date, 'Buß- und Bettag'::text
        from generate_series(make_date(p_year, 11, 16), make_date(p_year, 11, 22), '1 day') d
       where extract(dow from d) = 3;
  end if;
end;
$$;

revoke execute on function german_holidays(int, text) from public, anon;
grant execute on function german_holidays(int, text) to authenticated;
revoke execute on function easter_sunday(int) from public, anon;
grant execute on function easter_sunday(int) to authenticated;
