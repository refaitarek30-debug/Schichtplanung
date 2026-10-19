/**
 * Getrennt von anzeige.ts, damit das Wurzel-Layout (auch die Startseite)
 * dafür nicht den Datenbank-Baustein mitladen muss.
 */
export const ANZEIGE_SPEICHER = "schichtplan.anzeige";

/**
 * Läuft vor dem ersten Zeichnen (wie beim Farbschema), damit das Wochenende
 * nicht erst nach dem Laden aufleuchtet.
 */
export const ANZEIGE_SKRIPT = `(function(){var r=document.documentElement;try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(
  ANZEIGE_SPEICHER,
)})||"{}");r.setAttribute("data-wochenende",a.wochenende==="aus"||a.wochenende==="kraeftig"?a.wochenende:"leicht");}catch(e){r.setAttribute("data-wochenende","leicht");}})();`;
