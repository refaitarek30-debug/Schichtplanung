import type { ReactNode } from "react";

/**
 * Anmeldebereich: eigenes Layout ohne Sidebar, gleiche Designsprache.
 * Links das Produktversprechen, rechts das Formular.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
            SP
          </span>
          <span className="text-sm font-semibold tracking-tight">Schichtplan</span>
        </div>

        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Urlaub und Schicht in einem
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight">
            Urlaub planen, ohne die Schicht zu gefährden.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Jeder Antrag wird sofort gegen die Mindestbesetzung der betroffenen
            Schicht geprüft. Engpässe fallen auf, bevor jemand zusagt.
          </p>

          <dl className="mt-8 grid grid-cols-3 gap-3">
            {[
              { term: "Grün", detail: "Soll-Besetzung erfüllt" },
              { term: "Gelb", detail: "unter Soll, Mindest hält" },
              { term: "Rot", detail: "Mindestbesetzung reißt" },
            ].map((item, index) => (
              <div key={item.term} className="rounded-xl bg-surface-muted px-3 py-3">
                <dt className="flex items-center gap-1.5 text-[13px] font-medium">
                  <span
                    className={
                      ["h-2 w-2 rounded-full bg-ok-dot", "h-2 w-2 rounded-full bg-warn-dot", "h-2 w-2 rounded-full bg-crit-dot"][
                        index
                      ]
                    }
                  />
                  {item.term}
                </dt>
                <dd className="mt-1 text-[12px] leading-snug text-ink-muted">
                  {item.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[12px] text-ink-faint">
          Zugänge vergibt die Administration deines Unternehmens.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
