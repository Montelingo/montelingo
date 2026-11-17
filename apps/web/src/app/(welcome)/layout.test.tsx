import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WelcomeLayout from "./layout";

describe("WelcomeLayout", () => {
  it("wraps the page in the Montenegrin main landmark the skip link targets", () => {
    render(
      <WelcomeLayout>
        <h1>Page</h1>
      </WelcomeLayout>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("lang", "sr-Latn-ME");
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
  });

  it("has no site header", () => {
    render(
      <WelcomeLayout>
        <h1>Page</h1>
      </WelcomeLayout>,
    );

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
