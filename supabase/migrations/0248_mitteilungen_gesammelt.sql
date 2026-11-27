-- =============================================================
-- 0248 · Mitteilungen von verbundenen Personen: höchstens 3, der Rest gesammelt
--
-- Wer bei jemand anderem einträgt, ändert oder löscht, löst dort bisher je
-- Änderung eine Mitteilung aus. Wer viel auf einmal einträgt, hätte das Handy
-- der anderen Person damit überflutet.
--
-- Jetzt je Absender höchstens 3 Mitteilungen. Alles danach wird nur gezählt und
-- beim nächsten Öffnen der App als Hinweis gezeigt („Lea hat noch 12 weitere
-- Änderungen bei dir gemacht“). Wieder klingeln darf es, sobald die Person die
-- App geöffnet hat – spätestens einen Tag nach der ersten Mitteilung.
--
-- Außerdem: Eine verbundene Person kann bei jemandem höchstens 300 Termine
-- eintragen – sonst könnte sie den Kalender bis zur Grenze (2000) vollmachen.
-- =============================================================

create table if not exists public.verbunden_meldestand (
  empfaenger uuid not null references auth.users(id) on delete cascade,
  -- Konto (bei Verbindungen) oder Person (beim Partner-Link)
  absender uuid not null,
  name text not null default 'Jemand',
  gepusht integer not null default 0,
  gesammelt integer not null default 0,
  seit timestamptz not null default now(),
  primary key (empfaenger, absender)
);
alter table public.verbunden_meldestand enable row level security;
revoke all on table public.verbunden_meldestand from public, anon, authenticated;

-- Mitteilung mit Deckel: die ersten 3 klingeln, alles Weitere wird gezählt.
create or replace function public._verbunden_push(
  p_inhaber uuid, p_absender uuid, p_name text, p_titel text, p_text text, p_tag text, p_sammel text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  st verbunden_meldestand;
  zusammen boolean;
begin
  if p_inhaber is null or p_absender is null then
    return;
  end if;
  insert into verbunden_meldestand (empfaenger, absender, name)
  values (p_inhaber, p_absender, left(coalesce(nullif(p_name, ''), 'Jemand'), 60))
  on conflict (empfaenger, absender) do update set name = excluded.name
  returning * into st;

  -- Einen Tag nach der ersten Mitteilung darf es wieder klingeln.
  if st.gepusht > 0 and st.seit < now() - interval '24 hours' then
    update verbunden_meldestand set gepusht = 0 where empfaenger = p_inhaber and absender = p_absender;
    st.gepusht := 0;
  end if;

  -- Wartet schon eine gesammelte Mitteilung (noch nicht verschickt), kommt das mit hinein.
  zusammen := p_sammel is not null and exists (
    select 1 from push_warteschlange w
     where w.user_id = p_inhaber and w.sammel = p_sammel and w.gesendet_am is null);

  if zusammen then
    perform push_einreihen(p_inhaber, 'teilen', p_titel, p_text, '/start', p_tag, p_sammel);
  elsif st.gepusht < 3 then
    perform push_einreihen(p_inhaber, 'teilen', p_titel,
      case when st.gepusht = 2 then coalesce(p_text, '') || ' · Weiteres siehst du in der App.' else p_text end,
      '/start', p_tag, p_sammel);
    update verbunden_meldestand
       set gepusht = gepusht + 1,
           seit = case when gepusht = 0 then now() else seit end
     where empfaenger = p_inhaber and absender = p_absender;
  else
    update verbunden_meldestand set gesammelt = gesammelt + 1
     where empfaenger = p_inhaber and absender = p_absender;
  end if;
end;
$$;
revoke all on function public._verbunden_push(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

-- Änderungen über eine Verbindung (Stand 0246, jetzt mit Deckel).
create or replace function public._verbunden_mitteilen(p_inhaber uuid, p_titel text, p_text text, p_tag text, p_sammel text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  wer text := coalesce(nullif(inhaber_vorname(auth.uid()), ''), 'Jemand');
begin
  if not verbunden_melden(p_inhaber, auth.uid()) then
    return;
  end if;
  perform _verbunden_push(p_inhaber, auth.uid(), wer, wer || ' ' || p_titel, p_text, p_tag, p_sammel);
exception when others then
  null;
end;
$$;
revoke all on function public._verbunden_mitteilen(uuid, text, text, text, text) from public, anon, authenticated;

-- Neuer Termin von einer verbundenen Person oder über den Partner-Link (Stand 0246, jetzt mit Deckel).
create or replace function public.push_aus_termin_von_anderen()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  wer text;
  aktuell_user uuid;
  aktuell_person uuid;
begin
  begin
    if not new.von_partner then
      return null;
    end if;
    select t.von_user, t.person_id into aktuell_user, aktuell_person from kalender_termine t where t.id = new.id;
    if aktuell_user is not null then
      if not verbunden_melden(new.owner_id, aktuell_user) then
        return null;
      end if;
      wer := inhaber_vorname(aktuell_user);
    elsif aktuell_person is not null then
      select name into wer from kalender_personen where id = aktuell_person;
    end if;
    wer := coalesce(nullif(wer, ''), 'Jemand');
    perform _verbunden_push(new.owner_id,
      -- ohne Konto und Person (alter Partner-Link): alle zusammen unter dem Inhaber selbst
      coalesce(aktuell_user, aktuell_person, new.owner_id), wer,
      '🗓️ ' || wer || ' hat bei dir eingetragen',
      coalesce(nullif(new.titel, ''), 'Termin') || ' · ' || to_char(new.datum, 'DD.MM.')
        || case when new.beginn is not null then ' ' || to_char(new.beginn, 'HH24:MI') else '' end,
      'termin-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- Termine bei verbundenen Personen (Stand 0246) – neu: höchstens 300 je eintragender Person.
create or replace function public.verbindung_termin_speichern(
  p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  neu uuid;
  eigener boolean;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum and p_bis_datum <= p_datum + 62 then p_bis_datum end;
begin
  if not kalender_nutzer() or not verbunden_darf(p_partner, ich) then
    raise exception 'Du darfst hier nichts eintragen.';
  end if;
  if p_id is null then
    if (select count(*) from kalender_termine where owner_id = p_partner and von_user = ich) >= 300 then
      raise exception 'Du hast bei dieser Person schon 300 Termine eingetragen – mehr geht nicht.';
    end if;
    neu := termin_schreiben(p_partner, true, null, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                            p_wiederholung, p_notiz, p_ort);
    update kalender_termine set von_user = ich, bis_datum = bis where id = neu;
    return neu;
  end if;
  if not _verbunden_termin_erlaubt(p_id, p_partner) then
    raise exception 'Diesen Termin kannst du nicht ändern.';
  end if;
  -- Ändern: wer ihn eingetragen hat, bleibt gleich.
  select von_partner into eigener from kalender_termine where id = p_id;
  update kalender_termine set bis_datum = null where id = p_id;
  neu := termin_schreiben(p_partner, eigener, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set bis_datum = bis where id = neu;
  perform _verbunden_mitteilen(p_partner, 'hat einen Termin bei dir geändert',
    coalesce(nullif(p_titel, ''), 'Termin') || ' · ' || to_char(p_datum, 'DD.MM.')
      || case when p_beginn is not null and not coalesce(p_ganztaegig, false) then ' ' || to_char(p_beginn, 'HH24:MI') else '' end,
    'termin-' || neu::text, 'termin-aenderung-' || neu::text);
  return neu;
end;
$$;

-- Beim Öffnen der App: was ohne Mitteilung dazugekommen ist. Wer die App offen hat,
-- hat die Mitteilungen gesehen – ab jetzt darf es wieder klingeln.
create or replace function public.verbunden_hinweise()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  ergebnis jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'anzahl', m.gesammelt) order by m.name), '[]'::jsonb)
    into ergebnis
    from verbunden_meldestand m
   where m.empfaenger = auth.uid() and m.gesammelt > 0;
  update verbunden_meldestand set gepusht = 0 where empfaenger = auth.uid() and gepusht > 0;
  return ergebnis;
end;
$$;
revoke all on function public.verbunden_hinweise() from public, anon;
grant execute on function public.verbunden_hinweise() to authenticated;

-- Hinweis weggetippt.
create or replace function public.verbunden_hinweise_gesehen()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update verbunden_meldestand set gesammelt = 0 where empfaenger = auth.uid() and gesammelt > 0;
end;
$$;
revoke all on function public.verbunden_hinweise_gesehen() from public, anon;
grant execute on function public.verbunden_hinweise_gesehen() to authenticated;
