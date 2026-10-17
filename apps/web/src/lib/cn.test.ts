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

  it.each([
    ["spacing", "p-gutter", "p-4"],
    ["touch sizes", "size-touch", "size-touch-lg"],
    ["minimum heights", "min-h-touch", "min-h-touch-lg"],
    ["safe-area padding", "pl-safe-l", "pl-4"],
    ["radii", "rounded-tile", "rounded-lg"],
    ["animations", "animate-wiggle", "animate-none"],
    ["aspect ratios", "aspect-tile", "aspect-square"],
    ["maximum widths", "max-w-learner", "max-w-md"],
  ])("resolves conflicts with the custom %s tokens", (_tokens, first, last) => {
    expect(cn(first, last)).toBe(last);
    expect(cn(last, first)).toBe(first);
  });

  it("keeps custom tokens that do not conflict", () => {
    expect(cn("p-gutter", "pl-safe-l", "rounded-tile", "animate-wiggle")).toBe(
      "p-gutter pl-safe-l rounded-tile animate-wiggle",
    );
  });
});
