import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
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
