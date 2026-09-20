/**
 * Zwischenseite zwischen Link und Einlösen.
 *
 * Warum es diese Seite gibt: Mail- und Messenger-Dienste rufen jeden
 * zugestellten Link automatisch ab – für Vorschaubild und Virenprüfung.
 * Würde dieser Abruf schon das Einmal-Token einlösen, wäre der Link für
 * die eingeladene Person beim ersten eigenen Klick bereits verbraucht.
 * Genau das ist passiert: Link erzeugt 17:39:44, Token weg 17:39:50.
 *
 * Ein Abruf sieht deshalb nur diese Seite. Eingelöst wird erst, wenn die
 * Schaltfläche gedrückt wird – das ist ein POST, und den schickt kein
 * Scanner.
 */
export default async function BestaetigenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const einzeln = (wert: string | string[] | undefined) =>
    typeof wert === "string" ? wert : "";

  const tokenHash = einzeln(params.token_hash);
  const type = einzeln(params.type);
  const weiter = einzeln(params.weiter);

  const einladung = type === "invite";
  const unvollstaendig = !tokenHash || !type;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">
          {einladung ? "Willkommen" : "Passwort neu setzen"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {einladung
            ? "Noch ein Schritt: Bestätige, dass du es bist, dann vergibst du dein Passwort."
            : "Bestätige den Link, dann kannst du ein neues Passwort vergeben."}
        </p>
      </div>

      {unvollstaendig ? (
        <p role="alert" className="text-sm text-crit-fg">
          Dieser Link ist unvollständig. Bitte einen neuen anfordern.
        </p>
      ) : (
        <form method="POST" action="/auth/callback" className="space-y-4">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="weiter" value={weiter} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white"
          >
            {einladung ? "Zugang einrichten" : "Weiter zum Passwort"}
          </button>
        </form>
      )}

      <p className="text-[12px] leading-snug text-ink-faint">
        Dieser Zwischenschritt schützt deinen Link: Mail- und
        Messenger-Dienste rufen Adressen beim Zustellen automatisch ab. Ohne
        ihn wäre dein Link verbraucht, bevor du ihn überhaupt öffnest.
      </p>
    </div>
  );
}
