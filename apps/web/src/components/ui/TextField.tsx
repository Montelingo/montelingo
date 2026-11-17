import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import {
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useId,
} from "react";

import { cn } from "@/lib/cn";

// The site's plain field, and the designers' kit's field for the welcome
// screens (Figma "1 · Welcome & Auth"): white, a 3px ink edge, rounded, its
// icon inside, a sky edge while focused, and red edge, fill and message (with
// the warning icon) when it has an error.
const APPEARANCES = {
  site: {
    root: "gap-1.5",
    head: "flex flex-col gap-1.5",
    label: "text-sm font-medium text-slate-900",
    description: "text-sm text-slate-600",
    input: cn(
      "rounded-lg border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
      "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
    ),
    valid: "border-slate-500",
    invalid: "border-red-700",
    error: "text-sm font-medium text-red-700",
  },
  kid: {
    root: "gap-1",
    head: "flex flex-wrap items-baseline justify-between gap-x-3",
    label: "text-lg font-semibold text-kid-ink",
    description: "text-base font-medium text-kid-muted",
    input: cn(
      "h-touch-lg rounded-kid border-3 px-4 text-lg font-medium text-kid-ink placeholder:text-kid-muted",
      "focus:border-kid-sea focus:outline-none focus:ring-4 focus:ring-kid-sea/40",
      "disabled:cursor-not-allowed disabled:opacity-60",
    ),
    valid: "border-kid-ink bg-white",
    invalid: "border-red-700 bg-red-50",
    error: "flex items-start gap-1.5 text-base font-semibold text-red-800",
  },
} as const;

export type TextFieldAppearance = keyof typeof APPEARANCES;

export type TextFieldProps = Omit<
  ComponentPropsWithRef<"input">,
  "aria-invalid"
> & {
  label: string;
  description?: string;
  /** Shown below the input and announced with it. May contain a link to a way out. */
  error?: ReactNode;
  /** A control rendered inside the right edge of the input, such as a toggle. */
  endAdornment?: ReactNode;
  /** The site's plain field (the default) or the kit's, for the welcome screens. */
  appearance?: TextFieldAppearance;
  /** A decorative icon inside the left edge of the input (the kit's only), such as a Heroicon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export function TextField({
  label,
  description,
  error,
  endAdornment,
  appearance = "site",
  icon: Icon,
  id,
  type = "text",
  className,
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);
  const describedBy = [
    ariaDescribedBy,
    description ? descriptionId : undefined,
    hasError ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const styles = APPEARANCES[appearance];
  const isKid = appearance === "kid";

  return (
    <div className={cn("flex flex-col", styles.root, className)}>
      {/* The kit puts a short note on the label's row, which keeps a form with
          every field in error on one tablet screen. */}
      <div className={styles.head}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        ) : null}
      </div>
      <div className="relative">
        {isKid && Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Icon aria-hidden="true" className="size-6 text-kid-ink" />
          </div>
        ) : null}
        <input
          {...inputProps}
          id={inputId}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "block w-full",
            styles.input,
            hasError ? styles.invalid : styles.valid,
            isKid && Icon ? "pl-12" : undefined,
            endAdornment ? (isKid ? "pr-14" : "pr-12") : undefined,
          )}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {endAdornment}
          </div>
        ) : null}
      </div>
      {hasError ? (
        <p id={errorId} className={styles.error}>
          {isKid ? (
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-red-700"
            />
          ) : null}
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
