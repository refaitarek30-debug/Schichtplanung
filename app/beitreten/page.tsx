import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Einem Betrieb beitreten – ShiftNexo",
  robots: { index: false, follow: false },
};

/** Code aus dem Betrieb eingeben (Migration 0194) – weiter geht es auf /beitreten/<code>. */
export default async function BeitretenSeite({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const roh = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (roh) redirect(`/beitreten/${roh}`);
  return (
    <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
      <form action="/beitreten" method="get" className="glas w-full max-w-md rounded-[28px] p-6">
        <div className="text-[34px]" aria-hidden>
          🏢
        </div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight">Einem Betrieb beitreten</h1>
        <p className="mt-2 text-[15px] leading-snug text-ink-muted">
          Gib den Code ein, den du von deinem Betrieb bekommen hast. Dein Kalender bleibt – du entscheidest gleich, was
          im Betrieb mit erscheint.
        </p>
        <label htmlFor="beitritt-code" className="mt-4 block text-[13px] font-semibold text-ink-muted">
          Code
        </label>
        <input
          id="beitritt-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="z. B. ABCD2345"
          maxLength={12}
          className="tnum mt-1 w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[18px] font-semibold tracking-[0.12em] outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button type="submit" className="mt-4 h-12 w-full rounded-[16px] bg-brand-600 text-[16px] font-semibold text-white">
          Weiter
        </button>
        <Link href="/start" className="mt-2 flex h-11 items-center justify-center text-[15px] font-semibold text-ink-muted">
          Abbrechen
        </Link>
      </form>
    </main>
  );
}
