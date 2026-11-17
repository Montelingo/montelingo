// Holds the home panel's place while the session and profile load: the
// heading where it sits and the two buttons at the bottom, as in HomeScreen.
export function HomeScreenSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-6 pt-12 lg:pt-24">
      <span role="status" className="sr-only">
        Učitavam…
      </span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-20 animate-pulse rounded-md bg-kid-line" />
        <div className="h-14 w-4/5 animate-pulse rounded-md bg-kid-line" />
      </div>
      <div aria-hidden="true" className="mt-auto flex flex-col gap-4">
        <div className="h-touch-xl animate-pulse rounded-kid-lg bg-kid-line" />
        <div className="h-touch-xl animate-pulse rounded-kid-lg bg-kid-line" />
      </div>
    </div>
  );
}
