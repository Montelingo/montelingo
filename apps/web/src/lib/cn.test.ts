import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names and skips falsy ones", () => {
    expect(
      cn("px-4", false, undefined, null, "py-2", { "font-bold": true }),
    ).toBe("px-4 py-2 font-bold");
  });

  it("lets later Tailwind utilities override conflicting earlier ones", () => {
    expect(cn("px-4 text-slate-900", "px-2", "text-red-700")).toBe(
      "px-2 text-red-700",
    );
  });
});
