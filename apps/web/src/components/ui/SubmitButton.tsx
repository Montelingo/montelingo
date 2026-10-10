"use client";

import { type ComponentPropsWithRef, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";

type SubmitButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "type" | "aria-disabled"
> & {
  /** Overrides the parent form's pending state (from a `<form action>`). */
  pending?: boolean;
  pendingLabel?: string;
};

export function SubmitButton({
  pending,
  pendingLabel = "Submitting…",
  children,
  className,
  onClick,
  ...buttonProps
}: SubmitButtonProps) {
  const formStatus = useFormStatus();
  const isPending = pending ?? formStatus.pending;

  // aria-disabled keeps the button focusable while pending, so focus is not
  // lost mid-submit. Cancelling the click also blocks Enter-to-submit, which
  // the browser performs by clicking the default submit button.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isPending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...buttonProps}
      type="submit"
      aria-disabled={isPending || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        "disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700",
        isPending ? "cursor-wait bg-indigo-800 hover:bg-indigo-800" : undefined,
        className,
      )}
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}
