import Image from "next/image";
import type { ReactNode } from "react";

import { avatarSrc, PLACEHOLDER_EXPLORER } from "@/features/profile/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

type WelcomeFrameProps = {
  /** The picture on the left: the map's art (map's MapArt), filling its box. */
  art: ReactNode;
  children: ReactNode;
};

// The split screen of the welcome, auth and setup screens (Figma "1 · Welcome
// & Auth"): the map's art with the Montelingo badge on the left, from 1024px
// wide, and the cream panel on the right, which scrolls on a short screen.
// Fills the screen above whatever is under it.
export function WelcomeFrame({ art, children }: WelcomeFrameProps) {
  return (
    <div
      className={cn(
        fredoka.className,
        "fixed inset-0 grid bg-kid-cream lg:grid-cols-[1fr_minmax(0,40rem)]",
      )}
    >
      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden border-r-3 border-kid-ink bg-kid-sea lg:block"
      >
        {art}
        <div className="absolute bottom-16 left-10 flex items-center gap-4 rounded-kid-lg border-3 border-kid-ink bg-kid-yellow px-5 py-4 shadow-raised-6">
          <Image
            src={avatarSrc(PLACEHOLDER_EXPLORER.avatar)}
            alt=""
            width={64}
            height={64}
            unoptimized
          />
          <span className="flex flex-col">
            <span className="text-3xl font-semibold text-kid-ink">
              Montelingo
            </span>
            <span className="text-sm font-medium text-kid-ink">
              Mali istraživači, velike riječi
            </span>
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto px-gutter pb-safe-b pt-safe-t">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
