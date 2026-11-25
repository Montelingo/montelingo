import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import GrownUpsPage, { metadata } from "./page";

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

  it("has no accessibility violations", async () => {
    const { container } = render(<GrownUpsPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
