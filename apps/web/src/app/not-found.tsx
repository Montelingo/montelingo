import Link from "next/link";

// Replaces Next.js's default 404 page, which has no <main> for the root
// layout's "Skip to content" link to land on.
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="grid flex-1 place-items-center px-4 py-12 sm:px-8"
    >
      <div className="flex max-w-md flex-col items-start gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="text-slate-700">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          href="/"
          className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
