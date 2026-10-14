import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type FormNoticeProps = {
  /** Text, such as "Password updated — please sign in." Nothing renders when it is empty. */
  message?: ReactNode;
  className?: string;
};

// Good news about the form, such as the outcome of the step before it. A polite
// role="status" region, unlike FormAlert: it never interrupts the screen reader.
export function FormNotice({ message, className }: FormNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800",
        className,
      )}
    >
      {message}
    </div>
  );
}
