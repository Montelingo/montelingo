import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

// Building blocks for the auth forms' loading skeletons, in the welcome
// screens' shapes. Each form has its own skeleton (SignInFormSkeleton,
// SignUpFormSkeleton) that mirrors its layout, so nothing shifts when the form
// replaces it.

type AuthFormSkeletonProps = {
  /** The form's fields and links, between the heading and the submit button. */
  children: ReactNode;
  /** The form shows the "Za odrasle" chip above its heading. */
  hasChip?: boolean;
};

export function AuthFormSkeleton({
  children,
  hasChip = false,
}: AuthFormSkeletonProps) {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6">
      <span role="status" className="sr-only">
        Učitavam…
      </span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Bar className="size-touch-lg rounded-full" />
        <div className="flex flex-col gap-2">
          {hasChip ? <Bar className="h-8 w-28 rounded-full" /> : null}
          <Bar className="h-10 w-64" />
          <Bar className="h-7 w-72" />
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-1 flex-col gap-4">
        {children}
        <div className="mt-auto flex flex-col gap-4 pt-2">
          <Bar className="h-touch-xl rounded-kid-lg" />
          <Bar className="h-7 w-56 self-center" />
        </div>
      </div>
    </div>
  );
}

type FieldSkeletonProps = {
  /** The field shows a description (such as the password rule) under its label. */
  hasDescription?: boolean;
};

export function FieldSkeleton({ hasDescription = false }: FieldSkeletonProps) {
  return (
    <div className="flex flex-col gap-1">
      <Bar className="h-7 w-28" />
      {hasDescription ? <Bar className="h-6 w-44" /> : null}
      <Bar className="h-touch-lg rounded-kid" />
    </div>
  );
}

type LinkSkeletonProps = {
  className?: string;
};

export function LinkSkeleton({ className }: LinkSkeletonProps) {
  return <Bar className={cn("h-touch w-48", className)} />;
}

type BarProps = {
  className: string;
};

function Bar({ className }: BarProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-kid-line", className)} />
  );
}
