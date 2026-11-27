import type { Metadata } from "next";
import Link from "next/link";

import { SMALL_LINK } from "@/components/ui/kid-styles";
import { GrownUpsGate } from "@/features/grown-ups";
import { ME_PATH } from "@/features/map";
import { PRIVACY_PATH } from "@/features/privacy/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Za roditelje",
};

// The grown-ups area: the gate first on every load (#177), then the area. Its
// progress and account cards come with #178. It links to the privacy policy
// (#255).
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
      <Link href={PRIVACY_PATH} className={SMALL_LINK}>
        Politika privatnosti
      </Link>
    </GrownUpsGate>
  );
}
