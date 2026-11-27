/** The privacy policy page, readable without signing in (#255). */
export const PRIVACY_PATH = "/privatnost";

/**
 * The version of the policy text this app ships, the day it takes effect
 * (ADR 0008). It must equal the API's `PRIVACY_POLICY_VERSION` (#250): the
 * text is `content/<version>.mdx`, and a new version is a new file.
 *
 * The text is plain Markdown, with headings from level 2 (the page's title is
 * level 1). 2026-12-01 is a placeholder with the headings the policy must
 * cover, until Product's text, reviewed by a lawyer, replaces it.
 */
export const PRIVACY_POLICY_VERSION = "2026-12-01";
