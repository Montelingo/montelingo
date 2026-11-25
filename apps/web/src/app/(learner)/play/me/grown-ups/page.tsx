import type { Metadata } from "next";

import { GrownUpsGate } from "@/features/grown-ups";
import { ME_PATH } from "@/features/map";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Za roditelje",
};

// The grown-ups area: the gate first on every load (#177), then the area. Its
// progress and account cards come with #178.
export default function GrownUpsPage() {
  return (
    <GrownUpsGate closeHref={ME_PATH}>
      <h1
        className={cn(
          fredoka.className,
          "break-words text-4xl font-semibold text-kid-ink",
        )}
      >
        Za roditelje
      </h1>
    </GrownUpsGate>
  );
}
