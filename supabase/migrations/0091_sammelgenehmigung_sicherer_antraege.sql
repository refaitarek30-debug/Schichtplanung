-- "Alle sicheren Anträge genehmigen".
--
-- Genehmigt wird ein Antrag nur, wenn nach seiner Genehmigung
--   * die Mindestbesetzung nicht unterschritten wird,
--   * die Sollbesetzung nicht unterschritten wird,
--   * und keine geforderte Qualifikation unterbesetzt ist.
-- Alles andere bleibt ausstehend und wird von Hand entschieden.
--
-- Kein zweiter Prüfpfad: die Besetzung kommt aus
-- check_leave_staffing_impact, die Qualifikationen aus
-- shift_qualification_gaps, das Genehmigen selbst aus
-- decide_leave_request -- mit allem, was daran haengt (Gesamtzeitraum,
-- Kontopruefung, Protokoll, Benachrichtigung).
--
-- Wichtig: Antrag fuer Antrag, nacheinander. Jede Genehmigung veraendert
-- die Besetzung fuer die naechste Pruefung. Zwei Antraege, die einzeln
-- unbedenklich waeren, zusammen aber die Schicht leerraeumen, duerfen nicht
-- beide durchgehen.
--
-- Sortiert wird nach Eingang: wer zuerst beantragt hat, wird zuerst
-- geprueft. Das ist nachvollziehbar und unabhaengig von der Reihenfolge,
-- in der die Datenbank Zeilen liefert.
--
-- ACHTUNG: Diese Fassung enthaelt noch max(lr.employee_id) -- max(uuid)
-- gibt es in Postgres nicht. Die Korrektur steht in Migration 0093; beide
-- zusammen ergeben den Stand der produktiven Datenbank.
create or replace function public.approve_safe_leave_requests()
returns table (genehmigt int, uebersprungen int, geprueft int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  r record;
  v_sicher boolean;
  v_genehmigt int := 0;
  v_uebersprungen int := 0;
  v_geprueft int := 0;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  for r in
    -- Je Einreichung einmal: der ganze Zeitraum wird gemeinsam entschieden.
    select coalesce(lr.request_group_id, lr.id) as gruppe,
           (array_agg(lr.id order by lr.start_date))[1] as erste_id,
           max(lr.employee_id) as employee_id,
           min(lr.start_date) as von,
           max(lr.end_date) as bis,
           min(lr.created_at) as eingegangen
    from leave_requests lr
    where lr.company_id = v_firma
      and lr.status = 'pending'
    group by coalesce(lr.request_group_id, lr.id)
    order by min(lr.created_at), min(lr.start_date)
  loop
    v_geprueft := v_geprueft + 1;

    -- Besetzung: kein Tag darf unter Soll oder Mindest fallen.
    select not exists (
      select 1 from public.check_leave_staffing_impact(r.employee_id, r.von, r.bis) i
      where i.status <> 'ok'
    ) into v_sicher;

    -- Qualifikationen: an keinem Tag darf eine Anforderung reissen.
    if v_sicher then
      select not exists (
        select 1
        from generate_series(r.von, r.bis, interval '1 day') d
        cross join lateral public.shift_qualification_gaps(
          effective_shift_id(r.employee_id, d::date), d::date, r.employee_id) g
        where effective_shift_id(r.employee_id, d::date) is not null
          and g.fehlt > 0
      ) into v_sicher;
    end if;

    if v_sicher then
      begin
        perform public.decide_leave_request(r.erste_id, 'approved');
        v_genehmigt := v_genehmigt + 1;
      exception when others then
        -- Zum Beispiel ein nicht ausreichendes Urlaubskonto. Der Antrag
        -- bleibt ausstehend; die Sammelaktion laeuft weiter.
        v_uebersprungen := v_uebersprungen + 1;
      end;
    else
      v_uebersprungen := v_uebersprungen + 1;
    end if;
  end loop;

  return query select v_genehmigt, v_uebersprungen, v_geprueft;
end;
$$;

comment on function public.approve_safe_leave_requests() is
  'Genehmigt alle offenen Antraege, bei denen Soll- und Mindestbesetzung sowie alle Qualifikationsanforderungen erhalten bleiben. Prueft Antrag fuer Antrag nacheinander.';

revoke all on function public.approve_safe_leave_requests() from public, anon;
grant execute on function public.approve_safe_leave_requests() to authenticated;
