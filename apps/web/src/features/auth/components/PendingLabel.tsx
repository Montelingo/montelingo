import { cn } from "@/lib/cn";

type PendingLabelProps = {
  label: string;
  /** Shown, and the only one a screen reader hears, while `isPending`. */
  pendingLabel: string;
  isPending: boolean;
};

// A button's label and its pending label in one grid cell, so the button
// keeps the width of the longer one and nothing around it moves when it
// changes. The sign-out controls share it.
export function PendingLabel({
  label,
  pendingLabel,
  isPending,
}: PendingLabelProps) {
  return (
    <span className="grid">
      <span
        aria-hidden={isPending || undefined}
        className={cn(
          "col-start-1 row-start-1",
          isPending ? "invisible" : undefined,
        )}
      >
        {label}
      </span>
      <span
        aria-hidden={!isPending || undefined}
        className={cn(
          "col-start-1 row-start-1",
          isPending ? undefined : "invisible",
        )}
      >
        {pendingLabel}
      </span>
    </span>
  );
}
