import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * ESLint als Flat Config.
 *
 * Vorher stand in `package.json` nur `next lint`. Den Befehl gibt es seit
 * Next 16 nicht mehr – er hat „lint" als Verzeichnisnamen gelesen und mit
 * „no such directory" abgebrochen. ESLint war zudem gar nicht installiert.
 * Der Lint lief also seit dem Versionswechsel überhaupt nicht, ohne dass
 * es jemandem auffiel.
 *
 * `eslint-config-next` 16 liefert die Flat Config direkt mit; der Umweg
 * über `FlatCompat` scheitert dort an einer zirkulären Struktur.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      /**
       * Herabgestuft auf Warnung, nicht abgeschaltet – und hier steht,
       * warum, damit es niemand für stillschweigendes Grünfärben hält.
       *
       * Die Regel trifft an 33 Stellen dasselbe Lademuster:
       *
       *   const laden = useCallback(async () => { … await … ; setX(…) });
       *   useEffect(() => { void laden(); }, [laden]);
       *
       * `laden` ist `async`; jedes `setState` läuft erst nach dem ersten
       * `await`. Synchron im Effekt wird also nichts gesetzt – nachgeprüft
       * an den Aufrufstellen. Die Regel erkennt die Form, nicht das
       * Verhalten.
       *
       * Sie bleibt als Warnung stehen, damit neue Stellen auffallen, an
       * denen tatsächlich synchron gesetzt wird. Die 33 bestehenden
       * umzuschreiben wäre ein großer Umbau an funktionierendem Code – die
       * Warnungen sind im Bericht als offener Punkt vermerkt.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "supabase/**",
    ],
  },
];

export default eslintConfig;
