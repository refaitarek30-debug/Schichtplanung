-- Abwesenheitsarten aus der Excel-Vorlage.
--
-- Der Jahresplan kennt neun Kürzel, die Anwendung bisher vier Arten.
-- Drei kommen hinzu; `SE` (Seminar) wird auf die vorhandene Art
-- `schulung` abgebildet, statt ein zweites Konzept danebenzustellen.
--
-- Neue Enum-Werte lassen sich nicht im selben Vorgang verwenden, in dem
-- sie angelegt werden -- deshalb steht hier nur das Anlegen.

alter type absence_type add value if not exists 'sonderurlaub';
alter type absence_type add value if not exists 'altersfreizeit';
alter type absence_type add value if not exists 'bildungsurlaub';
