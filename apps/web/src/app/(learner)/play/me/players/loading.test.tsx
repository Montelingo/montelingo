import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import PlayersLoading from "./loading";

describe("PlayersLoading", () => {
  it("announces that the page is loading, with nothing to press", () => {
    render(<PlayersLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PlayersLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
