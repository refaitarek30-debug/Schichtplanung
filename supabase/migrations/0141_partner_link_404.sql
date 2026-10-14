-- Ungültiger Partnerlink: „nicht gefunden“ (HTTP 404) statt HTTP 500.
--
-- Die Funktionen meldeten einen beendeten/falschen Link mit errcode P0002.
-- PostgREST macht daraus HTTP 500 – in den Protokollen sah jeder alte Link
-- wie ein Serverfehler aus. PTxyz liefert genau den Status xyz.
-- (Die App erkennt beide Codes.)

do $$
declare f text;
begin
  for f in
    select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%errcode = ''P0002''%'
  loop
    execute replace(f, 'errcode = ''P0002''', 'errcode = ''PT404''');
  end loop;
end $$;
