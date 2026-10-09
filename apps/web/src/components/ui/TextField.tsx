import { type ComponentPropsWithRef, type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";

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
};

export function TextField({
  label,
  description,
  error,
  endAdornment,
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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
        {label}
      </label>
      {description ? (
        <p id={descriptionId} className="text-sm text-slate-600">
          {description}
        </p>
      ) : null}
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "block w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
            hasError ? "border-red-700" : "border-slate-500",
            endAdornment ? "pr-12" : undefined,
          )}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">
            {endAdornment}
          </div>
        ) : null}
      </div>
      {hasError ? (
        <p id={errorId} className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
