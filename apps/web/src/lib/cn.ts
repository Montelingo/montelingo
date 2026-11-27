import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scales. The custom tokens in
// tailwind.config.ts that it would not recognize are listed here, so a later
// `p-4` still replaces `p-gutter` and a later `animate-none` replaces
// `animate-wiggle`. Colours need no entry: any value is accepted as one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["touch", "touch-lg", "touch-xl", "gutter"],
      padding: ["safe-t", "safe-r", "safe-b", "safe-l"],
      borderRadius: [
        "tile",
        "badge",
        "kid-sm",
        "kid",
        "kid-md",
        "kid-lg",
        "kid-xl",
      ],
      borderWidth: ["3"],
    },
    classGroups: {
      animate: [{ animate: ["wiggle", "locked-flash"] }],
      aspect: [{ aspect: ["tile"] }],
      "max-w": [{ "max-w": ["learner", "tab"] }],
      shadow: [{ shadow: ["raised-4", "raised-6"] }],
    },
  },
});

/** Joins conditional class names; later Tailwind utilities win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
