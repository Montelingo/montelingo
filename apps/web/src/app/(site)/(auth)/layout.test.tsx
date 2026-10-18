import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthLayout from "./layout";

describe("AuthLayout", () => {
  it("wraps the page in the main landmark the skip link targets", () => {
    render(
      <AuthLayout>
        <h1>Page</h1>
      </AuthLayout>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
  });
});
