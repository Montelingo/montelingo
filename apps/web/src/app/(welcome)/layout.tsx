import { WelcomeFrame } from "@/features/learner";
import { MapArt } from "@/features/map";
import { MONTENEGRIN } from "@/lib/locale";

type WelcomeLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// The way in, / and then /sign-up or /sign-in (#152, #153): full screen in
// the welcome frame, without the site header, all in Montenegrin. The frame
// stays put between the three pages; only the panel changes.
export default function WelcomeLayout({ children }: WelcomeLayoutProps) {
  return (
    <main id="main-content" lang={MONTENEGRIN}>
      <WelcomeFrame art={<MapArt />}>{children}</WelcomeFrame>
    </main>
  );
}
