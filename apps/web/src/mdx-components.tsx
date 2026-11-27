import type { MDXComponents } from "mdx/types";

// Required by @next/mdx in the App Router. Each .mdx file gets its styled
// elements from where it is rendered (PrivacyPolicy), so nothing is added here.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return components;
}
