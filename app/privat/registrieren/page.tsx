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
    <div className="privat-schrift relative isolate flex min-h-screen flex-col">
      {/* Hintergrund wie in der App */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-surface-muted [background-image:var(--glas-hinter)]" />
      <header className="flex justify-center px-5 pt-8 sm:pt-12">
        <Link href="/" aria-label="ShiftNexo – Startseite" className="flex items-center gap-2 rounded-lg hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-500 text-[12.5px] font-bold tracking-tight text-white">
            SN
          </span>
          <span className="text-[16px] font-semibold tracking-tight">ShiftNexo</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-6 sm:pt-8">
        {/* Zuerst das Formular – auf dem Handy ohne Umweg. */}
        <div className="w-full max-w-[420px] rounded-[28px] bg-surface p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_24px_60px_-32px_rgba(17,24,39,0.3)] sm:p-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">Konto erstellen</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Dein Schichtkalender – kostenlos, ohne Werbung, ohne E-Mail. Schon dabei?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Anmelden
            </Link>
          </p>
          <PrivatRegistrierung disabled={!isSupabaseConfigured} />
        </div>

        <ul className="mt-8 grid w-full max-w-[420px] gap-3 px-2">
          {PUNKTE.map((p) => (
            <li key={p.text} className="flex items-start gap-3 text-[14px] leading-snug text-ink-muted">
              <p.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden />
              {p.text}
            </li>
          ))}
        </ul>
      </main>
      <LegalFooter className="px-5 pb-6 text-[12px] text-ink-faint" />
    </div>
  );
}
