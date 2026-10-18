import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Montelingo",
    template: "%s · Montelingo",
  },
  description: "Monorepo skeleton for web and api",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* A column, so each section's layout and each page's <main> can fill
          the height. The site pages add the header in (site)/layout.tsx; the
          learner area, in (learner), is full screen without it. */}
      <body className="flex flex-col">
        {/* The first stop for keyboard users: past the header or the learner
            controls to the page. Every page's <main> has id="main-content". */}
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-white font-semibold text-indigo-700 focus:not-sr-only focus:absolute focus:px-4 focus:py-2 focus:left-4 focus:top-4 focus:z-20 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
