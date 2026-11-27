import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type * as grownUps from "@/features/grown-ups";
import { GrownUpsGate } from "@/features/grown-ups";

import GrownUpsPage, { metadata } from "./page";

// The real gate. The link test swaps it once for a stand-in that shows the
// area at once, as if the grown-up had passed it.
vi.mock("@/features/grown-ups", async (importOriginal) => {
  const actual = await importOriginal<typeof grownUps>();
  return { ...actual, GrownUpsGate: vi.fn(actual.GrownUpsGate) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe("GrownUpsPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Za roditelje");
  });

  it("shows the gate on load, and not the area behind it", () => {
    render(<GrownUpsPage />);

    expect(
      screen.getByRole("dialog", { name: /^Pritisni i drži broj / }),
    ).toHaveAttribute("open");
    expect(
      screen.queryByRole("heading", { level: 1, name: "Za roditelje" }),
    ).not.toBeInTheDocument();
  });

  it("links to the privacy policy, behind the gate", () => {
    vi.mocked(GrownUpsGate).mockImplementationOnce(({ children }) => (
      <>{children}</>
    ));
    render(<GrownUpsPage />);

    expect(
      screen.getByRole("link", { name: "Politika privatnosti" }),
    ).toHaveAttribute("href", "/privatnost");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<GrownUpsPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
