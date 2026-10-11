// Mirrors AccountOverview: the heading and its line, then the email.
export function AccountOverviewSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="h-8 w-32 animate-pulse rounded-md bg-slate-200" />
        <div className="h-6 w-72 max-w-full animate-pulse rounded-md bg-slate-200" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="h-5 w-12 animate-pulse rounded-md bg-slate-200" />
        <div className="h-6 w-56 max-w-full animate-pulse rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
