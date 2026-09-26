-- Besetzungsregel mit festem Suchpfad.
--
-- zaehlt_zur_besetzung() liest nur eine Spalte der übergebenen Zeile; ein
-- Suchpfad spielt für sie keine Rolle. Der Supabase-Linter verlangt ihn
-- trotzdem zu Recht für jede Funktion im Schema public – also leer setzen.
alter function public.zaehlt_zur_besetzung(public.employees) set search_path = '';
