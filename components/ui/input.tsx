import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-ink-faint disabled:bg-surface-muted disabled:text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
