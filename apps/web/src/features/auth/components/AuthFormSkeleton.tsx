import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

// Building blocks for the auth forms' loading skeletons. Each form has its own
// skeleton (SignInFormSkeleton, SignUpFormSkeleton) that mirrors its layout,
// so nothing shifts when the form replaces it.

type AuthFormSkeletonProps = {
  /** The form's fields and links, between the heading and the submit button. */
  children: ReactNode;
};

export function AuthFormSkeleton({ children }: AuthFormSkeletonProps) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <Bar className="h-8 w-48" />
        <Bar className="h-6 w-64" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {children}
        <div className="h-10 animate-pulse rounded-lg bg-slate-300" />
      </div>
      <div aria-hidden="true" className="flex justify-center">
        <Bar className="h-5 w-56" />
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
    <div className="flex flex-col gap-1.5">
      <Bar className="h-5 w-24" />
      {hasDescription ? <Bar className="h-5 w-52" /> : null}
      <div className="h-11 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}

export function LinkSkeleton({ className }: { className?: string }) {
  return <Bar className={cn("h-5 w-32", className)} />;
}

function Bar({ className }: { className: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />
  );
}
