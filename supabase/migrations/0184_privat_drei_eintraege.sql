-- Privatbereich: bis zu drei Einträge je Tag (Ebene 3) und Schichtfolge
-- bis zu vier Jahre (vorher drei).

alter table public.privat_tage drop constraint if exists privat_tage_ebene_check;
alter table public.privat_tage add constraint privat_tage_ebene_check check (ebene in (1, 2, 3));

-- Wie 0148, nur die Höchstdauer ist größer. Schreibt weiter nur Ebene 1.
create or replace function public.privat_rotation_anwenden(
  p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean
)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  laenge integer := coalesce(array_length(p_muster, 1), 0);
  anzahl integer;
begin
  if not ist_privatkonto(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if laenge < 1 or laenge > 56 then
    raise exception 'Das Muster muss 1 bis 56 Tage lang sein.';
  end if;
  if p_start is null or p_bis is null or p_bis < p_start or p_bis - p_start > 1470 then
    raise exception 'Bitte einen Zeitraum von höchstens vier Jahren wählen.';
  end if;
  if exists (select 1 from unnest(p_muster) m
              where m is not null
                and not exists (select 1 from privat_schichtarten s where s.id = m and s.user_id = ich)) then
    raise exception 'Unbekannte Schichtart im Muster.';
  end if;

  if p_ueberschreiben then
    delete from privat_tage
     where user_id = ich and ebene = 1 and tag between p_start and p_bis
       and p_muster[((tag - p_start) % laenge) + 1] is null;
  end if;

  insert into privat_tage (user_id, tag, ebene, schichtart_id)
  select ich, d::date, 1, p_muster[(((d::date) - p_start) % laenge) + 1]
    from generate_series(p_start, p_bis, interval '1 day') d
   where p_muster[(((d::date) - p_start) % laenge) + 1] is not null
  on conflict (user_id, tag, ebene) do update
     set schichtart_id = excluded.schichtart_id
   where p_ueberschreiben;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;
