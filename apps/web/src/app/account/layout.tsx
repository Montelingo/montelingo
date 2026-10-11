type AccountLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// The account pages, and their loading and error states: one card.
export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <main id="main-content" className="flex-1 px-4 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 sm:p-8">
        {children}
      </div>
    </main>
  );
}
