import { MapIcon } from "@heroicons/react/24/solid";

// What /play shows until the map arrives (#67): a calm note, with nothing to
// press, so no fixture data ever reaches a learner.
export function LearnerHomePlaceholder() {
  return (
    <section
      aria-labelledby="learner-home-title"
      className="flex flex-col gap-6"
    >
      <h1 id="learner-home-title" className="text-3xl font-bold text-ink">
        Your map
      </h1>
      <div className="flex flex-col items-center gap-3 rounded-tile border-2 border-tile-available-edge bg-surface px-6 py-10 text-center shadow-sm">
        <MapIcon
          aria-hidden="true"
          className="size-16 text-tile-available-edge"
        />
        <p className="text-2xl font-bold text-ink">Your map is on its way</p>
        <p className="text-lg text-ink-muted">
          Soon you’ll pick a place to explore here.
        </p>
      </div>
    </section>
  );
}
