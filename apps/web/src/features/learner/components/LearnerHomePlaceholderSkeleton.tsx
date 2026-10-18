// Mirrors LearnerHomePlaceholder: the heading, then the card. Plain blocks,
// not cards, so there is nothing to focus while the page loads.
export function LearnerHomePlaceholderSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div
        aria-hidden="true"
        className="h-9 w-40 animate-pulse rounded-md bg-surface-sunken"
      />
      <div
        aria-hidden="true"
        className="h-60 animate-pulse rounded-tile bg-surface-sunken"
      />
    </div>
  );
}
