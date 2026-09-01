import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";
import type { Employee } from "@/lib/types";

export function Avatar({
  employee,
  className,
}: {
  employee: Pick<Employee, "firstName" | "lastName">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[13px] font-semibold text-ink-muted",
        className,
      )}
      aria-hidden
    >
      {initials(employee.firstName, employee.lastName)}
    </span>
  );
}
