import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import WelcomeLoading from "./loading";

describe("WelcomeLoading", () => {
  it("announces in Montenegrin that the page is loading", () => {
    render(<WelcomeLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Učitavam…");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<WelcomeLoading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
