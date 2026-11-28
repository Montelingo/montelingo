import { CheckIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { type ComponentPropsWithRef, type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";

import { FOCUS_RING } from "./kid-styles";

export type CheckboxFieldProps = Omit<
  ComponentPropsWithRef<"input">,
  "type" | "aria-invalid" | "children"
> & {
  /** The text beside the box. It may contain a link, which opens without ticking the box. */
  label: ReactNode;
  /** Shown below the label and announced with the checkbox. */
  error?: ReactNode;
};

// The designers' kit's checkbox, for the welcome screens: a white box with the
// 3px ink edge that fills yellow with an ink tick, and red edge, fill and
// message (with the warning icon) when it has an error, as TextField's kid
// appearance. The whole row is the label, so the label text toggles it too, and
// the box sits in a 48px square, which keeps the target above 44×44px.
export function CheckboxField({
  label,
  error,
  id,
  className,
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);
  const describedBy = [ariaDescribedBy, hasError ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        className="flex min-h-touch cursor-pointer items-start gap-2 text-lg font-medium text-kid-ink"
      >
        <span className="relative flex size-touch shrink-0 items-center justify-center">
          <input
            {...inputProps}
            id={inputId}
            type="checkbox"
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              "peer size-8 cursor-pointer appearance-none rounded-lg border-3",
              "checked:border-kid-ink checked:bg-kid-yellow",
              "disabled:cursor-not-allowed disabled:opacity-60",
              hasError ? "border-red-700 bg-red-50" : "border-kid-ink bg-white",
              FOCUS_RING,
            )}
          />
          <CheckIcon
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute size-6 text-kid-ink opacity-0 peer-checked:opacity-100"
          />
        </span>
        {/* Centred on the box's first line, then wraps under itself. */}
        <span className="py-2.5">{label}</span>
      </label>
      {hasError ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-base font-semibold text-red-800"
        >
          <ExclamationTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-red-700"
          />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
