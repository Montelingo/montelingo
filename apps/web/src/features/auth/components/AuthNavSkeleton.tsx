// Holds the account controls' place while the session lookup streams in. The
// header has a fixed height and the controls sit at its far end, so nothing
// moves when they replace this. Decorative: the controls announce themselves.
export function AuthNavSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-8 w-40 animate-pulse rounded-lg bg-slate-200"
    />
  );
}
