import { SiteHeader } from "@/features/auth/server";

type SiteLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// The site's pages (home, sign-in and the other auth pages, account) under
// the site header. The learner area, in (learner), has its own full-screen
// chrome instead. The root not-found page renders the header itself, since it
// sits outside this layout.
export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
