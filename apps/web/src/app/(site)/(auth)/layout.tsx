import { MONTENEGRIN } from "@/lib/locale";

type AuthLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// Shared by the sign-in, sign-up, and password-reset pages: one centered card.
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    // The auth pages are in Montenegrin (#153), so screen readers read them
    // in its voice; the rest of the site is still in English.
    <main
      id="main-content"
      lang={MONTENEGRIN}
      className="grid flex-1 place-items-center px-4 py-12 sm:px-8"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 sm:p-8">
        {children}
      </div>
    </main>
  );
}
