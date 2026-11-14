import { Fredoka } from "next/font/google";

// The learner area's display font (designers' handoff): Fredoka, SemiBold for
// map labels and numbers, Medium for captions. Loaded once, here, so every
// screen that uses it shares one font file.
export const fredoka = Fredoka({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});
