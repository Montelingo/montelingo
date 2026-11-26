import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_VERSION } from "./policy";

describe("PRIVACY_POLICY_VERSION", () => {
  it("is a date, the day the text takes effect (ADR 0008)", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // PrivacyPolicy imports the text by its file name. With one file, named by
  // the version, the page cannot show one text under another's version.
  it("names the one policy text the app ships", () => {
    const content = fileURLToPath(new URL("../content", import.meta.url));

    expect(readdirSync(content)).toEqual([`${PRIVACY_POLICY_VERSION}.mdx`]);
  });
});
