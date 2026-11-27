import type { Metadata } from "next";

import { PrivacyPolicy } from "@/features/privacy";
import { MONTENEGRIN } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Politika privatnosti",
};

// The privacy policy (#255), for anyone, signed in or not: families read it
// before they sign up. One column, with a 16px gutter on a phone.
export default function PrivacyPage() {
  return (
    <main id="main-content" lang={MONTENEGRIN} className="flex-1 px-4 py-12">
      <div className="mx-auto w-full max-w-prose">
        <PrivacyPolicy />
      </div>
    </main>
  );
}
