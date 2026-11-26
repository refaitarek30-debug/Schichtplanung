-- =============================================================
-- 0245 · Neue Privatkonten starten schlicht
--
-- Statt Früh/Spät/Nacht/Frei/Urlaub/Krank gibt es bei der Anmeldung nur noch
-- Arbeit, Urlaub, Arzt und Krank. Früh, Spät, Nacht und Frei legt die App von
-- selbst an, sobald man eine Vorlage für die Schichtfolge wählt.
-- Bestehende Konten bleiben unverändert.
-- =============================================================

create or replace function public._privat_konto_sicherstellen(p_user uuid, p_name text, p_version text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from privat_konten where user_id = p_user) then
    return false;
  end if;
  insert into privat_konten (user_id, name, datenschutz_version)
  values (p_user, left(coalesce(nullif(btrim(p_name), ''), 'Ich'), 80), p_version);
  if not exists (select 1 from privat_schichtarten where user_id = p_user) then
    insert into privat_schichtarten (user_id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge) values
      (p_user, 'Arbeit', 'A',  '#2F6FDE', 'arbeit', '08:00', '16:00', 8, 1),
      (p_user, 'Urlaub', 'U',  '#9B59D0', 'urlaub', null,    null,    8, 2),
      (p_user, 'Arzt',   'AZ', '#0EA5E9', 'frei',   null,    null,    0, 3),
      (p_user, 'Krank',  'K',  '#F76B15', 'krank',  null,    null,    8, 4);
  end if;
  update privat_schichtarten s
     set farbe = f.farbe
    from kalender_farben f
   where s.user_id = p_user
     and f.user_id = p_user
     and f.farbe ~ '^#[0-9a-fA-F]{6}$'
     and f.schluessel = case s.kuerzel
                          when 'F' then 'schicht:F' when 'S' then 'schicht:S' when 'N' then 'schicht:N'
                          when 'X' then 'frei' when 'U' then 'abw:U' when 'K' then 'abw:K'
                        end;
  return true;
end;
$$;
revoke execute on function public._privat_konto_sicherstellen(uuid, text, text) from public, anon, authenticated;
