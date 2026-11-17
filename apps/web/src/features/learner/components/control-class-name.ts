import { FOCUS_RING } from "@/components/ui/kid-styles";

// The learner area's round Back and Home controls: larger than the 48px
// minimum touch target, with a visible focus outline.
export const controlClassName = `inline-flex size-touch-lg shrink-0 items-center justify-center rounded-full border-2 border-ink-muted bg-surface text-ink shadow-sm hover:bg-surface-muted aria-[current=page]:bg-surface-muted ${FOCUS_RING}`;
