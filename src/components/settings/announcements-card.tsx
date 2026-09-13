"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDE } from "@/lib/dates";
import { fetchAnnouncements, DataError } from "@/lib/data/announcements";
import { createAnnouncement, retireAnnouncement } from "@/lib/auth/announcement-actions";
import type { FormState } from "@/lib/auth/actions";
import type { LiveAnnouncement } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState: FormState = {};

/**
 * Mitteilungen schreiben und zurückziehen. Was hier steht, erscheint bei
 * allen im Unternehmen auf dem Dashboard – zusammen mit den aktiven
 * Urlaubssperren, die direkt darunter gepflegt werden.
 */
export function AnnouncementsCard({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<LiveAnnouncement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(createAnnouncement, initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchAnnouncements(25));
    } catch (caught) {
      setItems([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.success) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await retireAnnouncement(id);
      if (result.error) setError(result.error);
      setBusyId(null);
      void load();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Mitteilungen"
        hint="erscheinen bei allen im Unternehmen auf dem Dashboard"
      />
      <CardBody className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {canManage ? (
          <form action={formAction} className="space-y-3 rounded-xl border border-line px-4 py-4">
            <Field label="Titel">
              <Input name="title" maxLength={120} placeholder="z. B. Wartung Anlage 3" required />
            </Field>
            <Field label="Text (optional)">
              <textarea
                name="body"
                rows={2}
                maxLength={2000}
                placeholder="Kurze Erläuterung für die Schichten"
                className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
              />
            </Field>
            <Field label="Art">
              <select
                name="level"
                defaultValue="info"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="info">Hinweis</option>
                <option value="warn">Wichtig</option>
              </select>
            </Field>
            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}
            <SubmitButton />
          </form>
        ) : null}

        {items === null ? (
          <RowSkeleton rows={2} />
        ) : items.length === 0 ? (
          <EmptyState title="Noch keine Mitteilungen veröffentlicht." />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-line px-4 py-3"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.level === "warn" ? "bg-warn-dot" : "bg-info-dot",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="text-[13px] leading-snug text-ink-muted">{item.body}</p>
                  ) : null}
                  <p className="tnum mt-1 text-[11px] text-ink-faint">
                    {formatDE(item.createdAt.slice(0, 10))}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={pending && busyId === item.id}
                    onClick={() => remove(item.id)}
                    aria-label="Mitteilung entfernen"
                    className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-surface-muted hover:text-crit-fg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird veröffentlicht …" : "Mitteilung veröffentlichen"}
    </Button>
  );
}
