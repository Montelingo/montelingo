import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { CurrentUser } from "../model/user";
import { AccountOverview } from "./AccountOverview";

const user: CurrentUser = {
  id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
  email: "ana@example.com",
  createdAt: "2026-09-01T10:00:00Z",
};

describe("AccountOverview", () => {
  it("is a section named by its heading", () => {
    render(<AccountOverview user={user} />);

    expect(screen.getByRole("region", { name: "Account" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument();
  });

  it("shows the user's email", () => {
    render(<AccountOverview user={user} />);

    expect(screen.getByRole("term")).toHaveTextContent("Email");
    expect(screen.getByRole("definition")).toHaveTextContent("ana@example.com");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AccountOverview user={user} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
