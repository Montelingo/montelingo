import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// edge.ts is imported by the middleware, which runs in the Edge runtime before
// every matched request, and by other features' modules, which may end up in
// the browser bundle. Nothing it reaches may be server-only, call the API, or
// render: it is pure functions and constants only.
const FORBIDDEN_IMPORTS = [
  "server-only",
  "next/headers",
  "react",
  "@/features/auth",
  "@/lib/api",
  "@/lib/api-config",
  "@/lib/browser-api",
  "@app/api-client",
];

const SRC_DIR = fileURLToPath(new URL("../../", import.meta.url));
const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\s[^;]*?["']([^"']+)["']/g;

function resolveModule(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = resolve(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }
  const candidate = [".ts", ".tsx", "/index.ts"]
    .map((extension) => `${base}${extension}`)
    .find((path) => existsSync(path));
  if (candidate === undefined) {
    throw new Error(`Cannot resolve ${specifier} from ${fromFile}`);
  }
  return candidate;
}

// Every import specifier reachable from `entry`, following the app's own
// modules (relative and @/ imports) and stopping at packages.
function reachableImports(entry: string): Map<string, string> {
  const imports = new Map<string, string>();
  const visited = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (visited.has(file)) {
      continue;
    }
    visited.add(file);
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(
      IMPORT_PATTERN,
    )) {
      if (specifier === undefined) {
        continue;
      }
      imports.set(specifier, file);
      const next = resolveModule(specifier, file);
      if (next !== null) {
        queue.push(next);
      }
    }
  }
  return imports;
}

describe("the auth feature's edge entry", () => {
  const imports = reachableImports(
    fileURLToPath(new URL("./edge.ts", import.meta.url)),
  );

  it("follows the modules it re-exports", () => {
    expect(imports.has("./model/protected-routes")).toBe(true);
    expect(imports.has("./model/routes")).toBe(true);
    expect(imports.has("./routes")).toBe(true);
  });

  it.each(FORBIDDEN_IMPORTS)("never reaches %s", (forbidden) => {
    expect(imports.get(forbidden)).toBeUndefined();
  });
});
