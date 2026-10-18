import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LearnerLayout, { viewport } from "./layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/play" }));

describe("LearnerLayout", () => {
  it("draws edge to edge, for the shell to pad back inside the safe area", () => {
    expect(viewport).toEqual({ viewportFit: "cover" });
  });

  it("frames the page in the learner chrome, without the site header", () => {
    render(
      <LearnerLayout>
        <h1>Page</h1>
      </LearnerLayout>,
    );

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/play",
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
  });
});
