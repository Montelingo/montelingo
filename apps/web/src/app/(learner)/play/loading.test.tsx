import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import PlayLoading from "./loading";

describe("PlayLoading", () => {
  it("announces that the map is loading, with nothing to press", () => {
    render(<PlayLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PlayLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
