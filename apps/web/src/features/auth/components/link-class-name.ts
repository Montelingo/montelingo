import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";

// Links in auth pages and messages. Always underlined, so they are not told
// apart from the surrounding text by color alone (WCAG 1.4.1).
export const linkClassName =
  "font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/** The same, on the welcome screens: ink, bold, and the kit's focus outline. */
export const kidLinkClassName = cn(
  "rounded-sm font-semibold text-kid-ink underline decoration-2 underline-offset-4",
  FOCUS_RING,
);
