import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-lg bg-surface-sunken", className)}
    />
  );
}

/** Platzhalter für Tabellenzeilen, während Supabase antwortet. */
export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-busy="true" aria-label="Daten werden geladen">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
