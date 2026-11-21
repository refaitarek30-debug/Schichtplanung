"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AtSign,
  Bell,
  Building2,
  CalendarArrowDown,
  ChevronRight,
  CircleHelp,
  Contrast,
  Eye,
  LayoutGrid,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Blatt } from "@/components/privat/blatt";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { employees } from "@/lib/demo-data";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { MailDeliveryCard } from "@/components/settings/mail-delivery-card";
import { ThemeToggle } from "@/components/layout/theme";
import { PrivacySettingsPanel } from "./privacy-settings-panel";
import { StartSeiteCard } from "@/components/settings/start-seite-card";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { KalenderVorliebenInhalt } from "@/components/kalender/kalender-einstellungen";
import { Gruppe, GruppenAufklappen, LinkZeile, Zeile } from "@/components/settings/gruppe";
import { StartKachelnGruppe } from "@/components/settings/start-kacheln";
import { roleLabels } from "@/lib/nav";
import type { Role } from "@/lib/types";

const permissions: { role: Role; items: string[] }[] = [
  {
    role: "employee",
    items: [
      "eigenes Dashboard, Urlaubskonto und Schichten sehen",
      "Urlaub beantragen und offene Anträge zurückziehen",
      "Abwesenheiten im Team sehen, ohne Grund der Abwesenheit",
    ],
  },
  {
    role: "shift_leader",
    items: [
      "Mitarbeiter der eigenen Schicht sehen",
      "Urlaubsanträge genehmigen oder ablehnen",
      "Besetzung und Engpässe der eigenen Schicht prüfen",
      "Abwesenheiten erfassen und verwalten",
    ],
  },
  {
    role: "admin",
    items: [
      "Mitarbeiter anlegen, bearbeiten und deaktivieren",
      "Schichten, Schichtmodelle und Mindestbesetzung definieren",
      "Urlaubskontingente, Feiertage und Betriebsferien verwalten",
      "Rollen vergeben und Unternehmensdaten pflegen",
    ],
  },
];

export default function SettingsPage() {
  const { company, mode, profile } = useSession();
  const istAdmin = profile?.role === "admin";
  const live = mode === "live";
  const [aktive, setAktive] = useState<number | null>(live ? null : employees.filter((e) => e.active).length);

  useEffect(() => {
    if (!live || !istAdmin) return;
    let aktiv = true;
    createClient()
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .then(({ count }) => {
        if (aktiv) setAktive(count ?? null);
      });
    return () => {
      aktiv = false;
    };
  }, [live, istAdmin]);

  const [blatt, setBlatt] = useState<null | "startseite" | "mitteilungen" | "abo" | "kollegen" | "darstellung" | "unternehmen" | "benachrichtigungen" | "mail" | "rollen">(null);
  const zu = () => setBlatt(null);
  // Aus der Suche im Menü „Mehr“: `?blatt=darstellung` öffnet gleich den Punkt.
  useEffect(() => {
    try {
      const w = new URLSearchParams(window.location.search).get("blatt");
      const erlaubt = ["startseite", "mitteilungen", "abo", "kollegen", "darstellung", "rollen", ...(istAdmin ? ["unternehmen", "benachrichtigungen", "mail"] : [])];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (w && erlaubt.includes(w)) setBlatt(w as typeof blatt);
    } catch {
      // ohne lesbare Adresse wie gewohnt
    }
    // Nur beim Öffnen der Seite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const kachel = "flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-card border border-line bg-surface p-3.5 text-left shadow-card transition-transform active:scale-[0.98]";
  const symbol = (farbe: string) => `flex h-8 w-8 items-center justify-center rounded-[10px] text-white ${farbe}`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5" data-einstellungen>
      <PageHeader title="Einstellungen" />

      <Link href="/profil" className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-muted">
        <Avatar employee={profile} className="h-11 w-11 text-[14px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {profile.firstName} {profile.lastName}
          </span>
          <span className="block truncate text-[12.5px] text-ink-muted">
            {roleLabels[profile.role]} · {company.name}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
      </Link>

      {/* Das Wichtigste als Kacheln, der Rest als kurze Listen – Details öffnen als Blatt. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-einstellungen-kacheln>
        <Link href="/profil?bereich=sicherheit" className={kachel}>
          <span className={symbol("bg-[#64748b]")}>
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[14.5px] font-semibold">Sicherheit</span>
            <span className="block text-[12px] text-ink-muted">Zwei-Faktor, Geräte</span>
          </span>
        </Link>
        {live ? (
          <button type="button" onClick={() => setBlatt("startseite")} className={kachel}>
            <span className={symbol("bg-brand-500")}>
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold">Startseite</span>
              <span className="block text-[12px] text-ink-muted">Ansicht und Kacheln</span>
            </span>
          </button>
        ) : null}
        {live ? (
          <button type="button" onClick={() => setBlatt("mitteilungen")} className={kachel}>
            <span className={symbol("bg-[#f59e0b]")}>
              <Bell className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold">Mitteilungen</span>
              <span className="block text-[12px] text-ink-muted">Aufs Handy</span>
            </span>
          </button>
        ) : null}
        {live ? (
          <button type="button" onClick={() => setBlatt("abo")} className={kachel}>
            <span className={symbol("bg-[#14b8a6]")}>
              <CalendarArrowDown className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold">Kalender-Abo</span>
              <span className="block text-[12px] text-ink-muted">Im Handy-Kalender</span>
            </span>
          </button>
        ) : null}
      </div>

      <Gruppe titel="Für mich">
        {live ? <ListenZeile icon={<Eye className="h-4 w-4" />} farbe="bg-[#0ea5e9]" text="Was Kollegen sehen" onClick={() => setBlatt("kollegen")} /> : null}
        <ListenZeile icon={<Contrast className="h-4 w-4" />} farbe="bg-[#334155]" text="Darstellung" onClick={() => setBlatt("darstellung")} />
        <ListenZeile icon={<Sparkles className="h-4 w-4" />} farbe="bg-[#8b5cf6]" text="Meine Zahlen" href="/meine-zahlen" />
        <ListenZeile icon={<LockKeyhole className="h-4 w-4" />} farbe="bg-[#22c55e]" text="Datenschutz & meine Daten" href="/profil/datenschutz" />
      </Gruppe>

      {live && istAdmin ? (
        <Gruppe titel="Betrieb">
          <ListenZeile icon={<Building2 className="h-4 w-4" />} farbe="bg-[#1d4ed8]" text="Unternehmen" wert={aktive === null ? undefined : `${aktive} aktiv`} onClick={() => setBlatt("unternehmen")} />
          <ListenZeile icon={<Mail className="h-4 w-4" />} farbe="bg-[#ef4444]" text="Benachrichtigungen" onClick={() => setBlatt("benachrichtigungen")} />
          <ListenZeile icon={<AtSign className="h-4 w-4" />} farbe="bg-[#16a34a]" text="Mailversand" onClick={() => setBlatt("mail")} />
          <ListenZeile
            icon={<Wand2 className="h-4 w-4" />}
            farbe="bg-[#7c3aed]"
            text="Einrichtung"
            wert={company.setupCompletedAt ? "fertig" : "offen"}
            href="/einrichtung"
          />
        </Gruppe>
      ) : null}

      <Gruppe>
        <ListenZeile icon={<CircleHelp className="h-4 w-4" />} farbe="bg-[#94a3b8]" text="Rollen und Rechte" onClick={() => setBlatt("rollen")} />
      </Gruppe>

      {/* Inhalte als Blatt – ohne Aufklapp-Gruppen darin. */}
      <GruppenAufklappen.Provider value={false}>
        {blatt === "startseite" ? (
          <Blatt titel="Startseite" onClose={zu}>
            <div className="space-y-5">
              <StartSeiteCard />
              <StartKachelnGruppe />
            </div>
          </Blatt>
        ) : null}
        {blatt === "mitteilungen" ? (
          <Blatt titel="Mitteilungen" unter="Aufs Handy und Vorschläge" onClose={zu}>
            <KalenderVorliebenInhalt firma />
          </Blatt>
        ) : null}
        {blatt === "abo" ? (
          <Blatt titel="Kalender-Abo" unter="Deine Schichten im Kalender deines Handys" onClose={zu}>
            <KalenderAboCard />
          </Blatt>
        ) : null}
        {blatt === "kollegen" ? (
          <Blatt titel="Was Kollegen sehen" unter="Leitung und Administration sehen immer alles." onClose={zu}>
            <PrivacySettingsPanel />
          </Blatt>
        ) : null}
        {blatt === "darstellung" ? (
          <Blatt titel="Darstellung" unter="Gilt nur auf diesem Gerät" onClose={zu}>
            <ThemeToggle />
          </Blatt>
        ) : null}
        {blatt === "unternehmen" ? (
          <Blatt titel="Unternehmen" onClose={zu}>
            <Gruppe>
              <Zeile titel="Name" inline rechts={<span className="text-[14px] text-ink-muted">{company.name}</span>} />
              <Zeile titel="Aktive Mitarbeiter" inline rechts={<span className="tnum text-[14px] text-ink-muted">{aktive ?? "…"}</span>} />
              <LinkZeile
                href="/einrichtung"
                titel="Einrichtung"
                text={company.setupCompletedAt ? "Abgeschlossen – jederzeit erneut durchgehen." : "Noch offen. Ohne Feiertage rechnet der Urlaub falsch."}
              />
            </Gruppe>
          </Blatt>
        ) : null}
        {blatt === "benachrichtigungen" ? (
          <Blatt titel="Benachrichtigungen" onClose={zu}>
            <NotificationSettings />
          </Blatt>
        ) : null}
        {blatt === "mail" ? (
          <Blatt titel="Mailversand" onClose={zu}>
            <MailDeliveryCard />
          </Blatt>
        ) : null}
        {blatt === "rollen" ? (
          <Blatt titel="Rollen und Rechte" onClose={zu}>
            <div className="space-y-4">
              {permissions.map((group) => (
                <div key={group.role}>
                  <p className="text-[14px] font-semibold">{roleLabels[group.role]}</p>
                  <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-ink-muted">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Blatt>
        ) : null}
      </GruppenAufklappen.Provider>
    </div>
  );
}

function ListenZeile({
  icon,
  farbe,
  text,
  wert,
  href,
  onClick,
}: {
  icon: ReactNode;
  farbe: string;
  text: string;
  wert?: string;
  href?: string;
  onClick?: () => void;
}) {
  const inhalt = (
    <>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-white ${farbe}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-[14.5px] font-medium">{text}</span>
      {wert ? <span className="shrink-0 text-[13px] text-ink-muted">{wert}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
    </>
  );
  const klasse = "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted";
  return href ? (
    <Link href={href} className={klasse}>
      {inhalt}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={klasse}>
      {inhalt}
    </button>
  );
}
