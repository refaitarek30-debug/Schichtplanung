import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf } from "../tabelle";
import { KAPITEL } from "./inhalt";
import { Gelesen } from "./gelesen";

export const metadata = { title: "Handbuch · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/**
 * Handbuch Privatbereich: damit neue Betreiber die App komplett kennen und
 * Support-Fragen beantworten können. Inhalt in ./inhalt.ts, Bilder in
 * /public/handbuch (Testkonto, fiktive Namen).
 */
export default async function KonsoleHandbuch() {
  await konsoleZugang();
  return (
    <>
      <Seitenkopf
        titel="Handbuch Privatbereich"
        text="Alles, was man über den kostenlosen Privatbereich wissen muss – Schritt für Schritt, mit Bildern. Kapitel abhaken, wenn du es gelesen und in der App selbst ausprobiert hast."
      />

      <nav aria-label="Inhalt" className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 text-[13px] font-semibold text-ink-muted">Inhalt</p>
        <ol className="grid gap-1 sm:grid-cols-2">
          {KAPITEL.map((k) => (
            <li key={k.id}>
              <a href={`#${k.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted">
                <Gelesen id={k.id} nurPunkt />
                <span>{k.titel}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {KAPITEL.map((k) => (
        <section key={k.id} id={k.id} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-4 sm:p-6" data-handbuch-kapitel={k.id}>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{k.titel}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{k.kurz}</p>
            </div>
            <Gelesen id={k.id} />
          </header>

          <div className={k.bilder?.length ? "mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" : "mt-4"}>
            <div className="space-y-5">
              {k.abschnitte.map((a) => (
                <div key={a.titel}>
                  <h3 className="text-[15px] font-semibold">{a.titel}</h3>
                  {a.text?.map((t) => (
                    <p key={t} className="mt-1.5 text-sm leading-relaxed text-ink">
                      {t}
                    </p>
                  ))}
                  {a.schritte ? (
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
                      {a.schritte.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  ) : null}
                  {a.tipp ? (
                    <p className="mt-2 rounded-lg border border-line bg-surface-muted px-3 py-2 text-[13px] leading-relaxed">
                      <b>Tipp:</b> {a.tipp}
                    </p>
                  ) : null}
                  {a.achtung ? (
                    <p className="mt-2 rounded-lg border border-crit-fg/30 bg-crit-fg/5 px-3 py-2 text-[13px] leading-relaxed">
                      <b>Achtung:</b> {a.achtung}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            {k.bilder?.length ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
                {k.bilder.map((b) => (
                  <figure key={b.datei} className="overflow-hidden rounded-xl border border-line bg-surface-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/handbuch/${b.datei}`} alt={b.alt} loading="lazy" className="w-full" />
                    <figcaption className="px-2 py-1.5 text-[12px] text-ink-muted">{b.alt}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </>
  );
}
