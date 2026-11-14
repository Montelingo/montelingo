import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(axeMatchers);

// vitest-axe only augments the legacy `Vi` namespace, so register its matcher types for Vitest 2.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- merging requires Vitest's exact `Assertion<T>` signature
  interface Assertion<T> extends AxeMatchers {}
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

// next/font is compiled by Next.js and has no runtime under Vitest. Every font
// loader returns the class name a component would put on its element.
vi.mock("next/font/google", () => ({
  Fredoka: () => ({ className: "font-fredoka", style: {} }),
}));

// jsdom has no canvas: getContext() logs "not implemented" and returns nothing.
// axe asks for one to measure SVG text, so answer the same nothing quietly.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = () => null;
}
