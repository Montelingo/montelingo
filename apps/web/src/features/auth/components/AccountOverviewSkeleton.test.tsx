import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AccountOverviewSkeleton } from "./AccountOverviewSkeleton";

describe("AccountOverviewSkeleton", () => {
  it("announces that the account is loading", () => {
    render(<AccountOverviewSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AccountOverviewSkeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
