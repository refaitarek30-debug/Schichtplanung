-- Regressionstest: kein Urlaubskürzel auf einem freien Tag im Schichtplan.
--
-- Ein Antrag über mehrere Wochen darf im Plan nur an Tagen stehen, an denen
-- die Person eine Schicht hat – genau die Tage, die vom Konto abgehen.
-- Prüft je Firma (aus Sicht ihrer Administration) das laufende und das
-- kommende Jahr in 62-Tage-Fenstern.
--
-- Läuft in einer Transaktion und endet immer mit einem Rollback
-- (raise exception 'ROLLBACK: …' – die Meldung enthält das Protokoll).
-- Erwartung: nur "OK"-Zeilen, keine "FEHLER"-Zeile.
--
-- Ausführen:  psql "$DATABASE_URL" -f supabase/tests/plan_urlaub_nur_arbeitstage.sql
--   oder über den SQL-Editor / MCP execute_sql.

do $test$
declare
  log text := '';
  firma record;
  von date := make_date(extract(year from current_date)::int, 1, 1);
  bis date := make_date(extract(year from current_date)::int + 1, 12, 31);
  fenster date;
  falsch int;
  gesamt_falsch int := 0;
begin
  for firma in
    select distinct on (p.company_id) p.company_id, p.id as profil, c.name
      from profiles p join companies c on c.id = p.company_id
     where p.role = 'admin'
     order by p.company_id, p.created_at
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', firma.profil, 'role', 'authenticated')::text, true);

    falsch := 0;
    fenster := von;
    while fenster <= bis loop
      select falsch + count(*) into falsch
        from shift_plan_grid(firma.company_id, fenster, 62) g
       where g.shift_name is null
         and g.absence_code in ('U','u','V','v','AF','af','SU','su','BU','bu','G','g');
      fenster := fenster + 62;
    end loop;

    log := log || case when falsch = 0
      then 'OK   ' || firma.name || ': kein Urlaub auf freien Tagen'
      else 'FEHLER ' || firma.name || ': ' || falsch || ' Urlaubskürzel auf freien Tagen' end || E'\n';
    gesamt_falsch := gesamt_falsch + falsch;
  end loop;

  raise exception 'ROLLBACK: %', E'\n' || log || case when gesamt_falsch = 0 then 'ALLES OK' else 'FEHLER GEFUNDEN' end;
end;
$test$;
