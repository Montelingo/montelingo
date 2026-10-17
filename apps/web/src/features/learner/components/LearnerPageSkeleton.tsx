// The learner area's neutral skeleton, for waits that come before any page's
// own loading.tsx (the session check): a heading and a body, in no one page's
// shape. Plain blocks, so there is nothing to focus while the page loads.
export function LearnerPageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div
        aria-hidden="true"
        className="h-9 w-48 animate-pulse rounded-md bg-surface-sunken"
      />
      <div
        aria-hidden="true"
        className="h-32 animate-pulse rounded-lg bg-surface-sunken"
      />
    </div>
  );
}
