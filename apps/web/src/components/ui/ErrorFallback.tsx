"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

import { cn } from "@/lib/cn";

import { ACTION_SIZE_STYLES, ACTION_STYLE } from "./action-style";

const DEFAULT_DESCRIPTION = "Check your connection and try again in a moment.";

// "large" is for touch-first screens: a bigger heading and a retry button at
// least as tall as the larger touch target.
const SIZE_STYLES = {
  default: {
    title: "text-2xl",
    description: "",
    button: ACTION_SIZE_STYLES.default,
  },
  large: {
    title: "text-3xl",
    description: "text-lg",
    button: ACTION_SIZE_STYLES.large,
  },
} as const;

type ErrorFallbackProps = {
  /** What could not be shown, such as "We couldn’t load this page." */
  title: string;
  /** The line under the title. Defaults to advice to check the connection. */
  description?: string;
  size?: keyof typeof SIZE_STYLES;
  /** The `reset` an `error.tsx` boundary receives. */
  reset: () => void;
};

// The body of a route's error.tsx: a message and a retry action. It never
// shows the error's own message, which may carry server details.
export function ErrorFallback({
  title,
  description = DEFAULT_DESCRIPTION,
  size = "default",
  reset,
}: ErrorFallbackProps) {
  const router = useRouter();
  const styles = SIZE_STYLES[size];

  // reset() alone re-renders the boundary with the same Server Component
  // payload; refreshing first fetches it again, so a passing failure can recover.
  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className={cn("font-bold text-ink", styles.title)}>{title}</h1>
      <p className={cn("text-ink-muted", styles.description)}>{description}</p>
      <button
        type="button"
        onClick={handleRetry}
        className={cn(ACTION_STYLE, styles.button)}
      >
        Try again
      </button>
    </div>
  );
}
