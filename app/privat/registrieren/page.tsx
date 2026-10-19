import Link from "next/link";
import { CalendarDays, Repeat, Share2, Smartphone } from "lucide-react";
import { LegalFooter } from "@/components/layout/legal-footer";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PrivatRegistrierung } from "@/components/privat/registrierung";

export const metadata = {
  title: "Schichtkalender kostenlos – ShiftNexo",
  description:
    "Dein Schichtkalender mit Schichtfolge, Feiertagen, Auswertung, Partner-Ansicht und Kalender-Abo fürs Handy. Kostenlos, ohne Werbung, nur Spitzname und Passwort.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ready-flame.vercel.app"),
  alternates: { canonical: "/privat/registrieren" },
  // Öffentlich: darf in Suchmaschinen erscheinen.
  robots: { index: true, follow: true },
};

const PUNKTE = [
  { icon: Repeat, text: "Schichtfolge einmal eintragen, der Kalender füllt sich selbst" },
  { icon: CalendarDays, text: "Woche, Monat und Jahr – mit Feiertagen deines Bundeslands" },
  { icon: Share2, text: "Partner einladen – ihr seht gegenseitig eure Schichten" },
  { icon: Smartphone, text: "Im Kalender deines Handys, mit Farben je Schicht" },
];

export default function PrivatRegistrierenSeite() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-8 border-b border-line bg-surface px-5 pb-8 pt-8 lg:border-b-0 lg:border-r lg:p-10">
        <Link href="/" aria-label="ShiftNexo – Startseite" className="flex w-fit items-center gap-2.5 rounded-lg hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
            SN
          </span>
          <span className="text-sm font-semibold tracking-tight">ShiftNexo</span>
        </Link>
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Für dich, kostenlos</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight text-balance sm:text-[34px]">
            Dein Schichtkalender. Einfach und übersichtlich.
          </h1>
          <ul className="mt-6 space-y-3">
            {PUNKTE.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-[14px] leading-snug">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <p.icon className="h-4 w-4" />
                </span>
                <span className="pt-1.5">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-[12px] text-ink-faint lg:block">
          Kein Abo, keine Werbung. Deine Einträge gehören dir – löschen jederzeit mit einem Klick.
        </p>
      </section>

      <section className="flex flex-col px-5 py-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-semibold tracking-tight">Konto anlegen</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Schon dabei?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Anmelden
              </Link>
            </p>
            <PrivatRegistrierung disabled={!isSupabaseConfigured} />
          </div>
        </div>
        <LegalFooter className="mt-10 pt-4 text-[12px] text-ink-faint" />
      </section>
    </div>
  );
}
