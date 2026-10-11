import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AccountLayout from "./layout";

describe("AccountLayout", () => {
  it("wraps the page in the main landmark the skip link targets", () => {
    render(
      <AccountLayout>
        <h1>Page</h1>
      </AccountLayout>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
  });
});
