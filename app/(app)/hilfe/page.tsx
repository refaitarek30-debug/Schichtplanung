"use client";

import { useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  LogIn,
  Palmtree,
  Users,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Schritt-für-Schritt-Anleitungen, bewusst einfach gehalten. */
const guides: { id: string; label: string; forRole: string[]; steps: Step[] }[] = [
  {
    id: "urlaub",
    label: "Urlaub beantragen",
    forRole: ["employee", "shift_leader", "admin"],
    steps: [
      {
        icon: LogIn,
        title: "1. Anmelden",
        body: "Öffne die Seite und melde dich mit deiner E-Mail-Adresse und deinem Passwort an. Beim ersten Mal bekommst du eine Einladung per E-Mail, in der du dein Passwort festlegst.",
      },
      {
        icon: Palmtree,
        title: "2. Auf „Urlaub“ tippen",
        body: "Im Menü unten (oder links) auf „Urlaub“ tippen. Du siehst dein Urlaubskonto: wie viele Tage du noch hast.",
      },
      {
        icon: CalendarDays,
        title: "3. Zeitraum auswählen",
        body: "Tippe im großen Kalender auf deinen ersten Urlaubstag, dann auf den letzten. Der Zeitraum wird farbig markiert. Die App rechnet dir sofort aus, wie viele Urlaubstage das kostet – freie Tage aus deinem Schichtplan zählen nicht mit.",
      },
      {
        icon: ClipboardCheck,
        title: "4. Antrag abschicken",
        body: "Auf „Antrag stellen“ tippen. Fertig. Deine Schichtleitung wird automatisch benachrichtigt und entscheidet. Du siehst den Status (offen, genehmigt, abgelehnt) in der Liste darunter.",
      },
    ],
  },
  {
    id: "schichten",
    label: "Meine Schichten sehen",
    forRole: ["employee", "shift_leader", "admin"],
    steps: [
      {
        icon: CalendarDays,
        title: "1. Auf „Schichtplan“ tippen",
        body: "Im Menü auf „Schichtplan“. Du siehst eine Tabelle: links die Namen, oben die Tage. In jedem Kästchen steht, wer wann arbeitet.",
      },
      {
        icon: CircleHelp,
        title: "2. Die Kürzel verstehen",
        body: "F = Frühschicht, S = Spätschicht, N = Nachtschicht. Das Haus-Symbol bedeutet frei. U = Urlaub, K = krank. Ganz unten steht eine Legende mit allen Farben.",
      },
      {
        icon: Users,
        title: "3. Deine eigene Zeile finden",
        body: "Deine Schichtgruppe (A, B, C oder D) steht als Überschrift. Suche deinen Namen – die Kästchen in deiner Zeile sind dein persönlicher Plan.",
      },
    ],
  },
  {
    id: "genehmigen",
    label: "Urlaub genehmigen",
    forRole: ["shift_leader", "admin"],
    steps: [
      {
        icon: ClipboardCheck,
        title: "1. Auf „Urlaubsanträge“ tippen",
        body: "Im Menü auf „Urlaubsanträge“. Du siehst alle offenen Anträge deiner Schicht.",
      },
      {
        icon: CircleHelp,
        title: "2. Besetzung prüfen",
        body: "Bei jedem Antrag zeigt ein farbiges Feld, ob an diesen Tagen genug Leute da sind. Rot heißt: die Mindestbesetzung wäre unterschritten. Du kannst trotzdem genehmigen, wenn es passt.",
      },
      {
        icon: ClipboardCheck,
        title: "3. Entscheiden",
        body: "Auf „Genehmigen“ oder „Ablehnen“ tippen. Bei einer Ablehnung musst du einen kurzen Grund angeben – der Mitarbeiter sieht ihn dann.",
      },
    ],
  },
];

export default function HelpPage() {
  const { role } = useSession();
  const available = guides.filter((g) => g.forRole.includes(role));
  const [active, setActive] = useState(available[0]?.id ?? "");
  const current = available.find((g) => g.id === active) ?? available[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Hilfe"
        title="Schritt-für-Schritt-Anleitung"
        description="Ganz einfach erklärt. Wähle oben, was du tun möchtest."
      />

      <div className="flex flex-wrap gap-2">
        {available.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              current?.id === g.id
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line bg-surface text-ink-muted hover:bg-surface-muted",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {current?.steps.map((step, index) => (
          <Card key={index}>
            <CardBody className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="text-center text-sm text-ink-muted">
          Kommst du nicht weiter? Wende dich an deine Schichtleitung oder die Person, die
          dir den Zugang eingerichtet hat.
        </CardBody>
      </Card>
    </div>
  );
}
