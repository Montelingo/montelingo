import type { MDXComponents } from "mdx/types";

import PolicyText from "../content/2026-12-01.mdx";
import { PRIVACY_POLICY_VERSION } from "../model/policy";

// The policy text's elements, styled here since the site has no typography
// plugin. The text's headings start at level 2, under the page's title.
const components: MDXComponents = {
  h2: ({ children, ...props }) => (
    <h2 className="mt-8 text-xl font-semibold text-slate-900" {...props}>
      {children}
    </h2>
  ),
  p: (props) => <p className="mt-3" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-1 pl-6" {...props} />,
  // Always underlined, so links are not told apart by colour alone (WCAG 1.4.1).
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      {...props}
    >
      {children}
    </a>
  ),
  // The text's one quote is the placeholder's notice, so it is a note beside
  // the policy, not a quotation.
  blockquote: ({ children }) => (
    <aside className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-1">
      {children}
    </aside>
  ),
};

// "Politika privatnosti" (#255): the policy text in one readable column, with
// its version at the top, the version a grown-up accepts at sign-up (#256).
export function PrivacyPolicy() {
  return (
    <article className="text-base leading-relaxed text-slate-700">
      <h1 className="text-3xl font-semibold text-slate-900">
        Politika privatnosti
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Verzija {PRIVACY_POLICY_VERSION}
      </p>
      <PolicyText components={components} />
    </article>
  );
}
