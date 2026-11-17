import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import type { ReactNode, Ref } from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";

import { fixBelow } from "../model/messages";

type ErrorSummaryProps = {
  /** From `useAuthForm()`: focus moves here after a rejected submit. */
  ref: Ref<HTMLDivElement>;
  /** How many fields the last attempt rejected, from `useAuthForm()`. */
  rejectedFieldCount: number;
  /** An error of the whole form (the API's), with any way out it offers. */
  formError: ReactNode;
};

// The welcome screens' error summary (Figma "Create your family account",
// error state): red, above the fields, saying how many fields to fix
// ("Ispravi 2 stvari ispod") and any error of the whole form. It takes focus
// after a rejected submit, and its alert is announced as well, as in the
// GOV.UK error summary. Render it with the attempt as its `key`, so the same
// errors are announced again on another try. Each field carries its own
// message.
export function ErrorSummary({
  ref,
  rejectedFieldCount,
  formError,
}: ErrorSummaryProps) {
  if (rejectedFieldCount === 0 && !formError) {
    return null;
  }
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn(
        "flex items-start gap-3 rounded-kid-lg border-3 border-red-700 bg-red-50 px-4 py-3 text-lg font-semibold text-red-800",
        FOCUS_RING,
      )}
    >
      <ExclamationTriangleIcon
        aria-hidden="true"
        className="mt-0.5 size-6 shrink-0 text-red-700"
      />
      <div role="alert" className="flex flex-col gap-1">
        {rejectedFieldCount > 0 ? <p>{fixBelow(rejectedFieldCount)}</p> : null}
        {formError ? <p>{formError}</p> : null}
      </div>
    </div>
  );
}
