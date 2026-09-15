-- =============================================================
-- Gescheiterte Registrierung hinterlaesst keine Karteileiche mehr
--
-- registerCompany() legt erst ueber register_company() das Unternehmen an
-- und meldet danach den Administrator per signUp() an. Scheitert der
-- zweite Schritt -- und er scheitert derzeit zuverlaessig, weil Supabase
-- die Bestaetigungsmail nicht zustellen kann und mit
-- "Error sending confirmation email" antwortet -- blieb ein vollstaendig
-- eingerichtetes Unternehmen ohne jeden Zugang zurueck: Firma, erster
-- Personalstammsatz, drei Schichten, zweiundzwanzig Feiertage. Niemand
-- kann sich darauf anmelden, niemand kann es loeschen, und in der
-- Betreiber-Uebersicht steht es als Geisterfirma.
--
-- Diese Funktion raeumt genau diesen Fall auf.
--
-- Warum sie gefahrlos fuer `anon` freigegeben werden kann: sie loescht
-- ausschliesslich ein Unternehmen, zu dem es *kein einziges Profil* gibt.
-- Sobald sich jemand angemeldet hat -- und das ist bei jeder echten Firma
-- ab der ersten Sekunde der Fall -- greift sie nicht mehr. Zusaetzlich
-- muss das Unternehmen gerade erst entstanden sein.
-- =============================================================

create or replace function discard_unclaimed_company(p_company_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_treffer int;
begin
  delete from companies c
   where c.id = p_company_id
     -- Kein Zugang: das Unternehmen wurde nie in Besitz genommen.
     and not exists (select 1 from profiles p where p.company_id = c.id)
     -- Und es ist frisch. Eine alte Karteileiche raeumt der Betreiber auf,
     -- nicht ein anonymer Aufruf von aussen.
     and c.created_at > now() - interval '15 minutes';

  get diagnostics v_treffer = row_count;
  return v_treffer > 0;
end;
$$;

revoke execute on function discard_unclaimed_company(uuid) from public;
grant execute on function discard_unclaimed_company(uuid) to anon, authenticated;
