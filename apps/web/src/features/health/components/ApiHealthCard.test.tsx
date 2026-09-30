import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { ApiHealthState } from "../model/health";
import { ApiHealthCard } from "./ApiHealthCard";

describe("ApiHealthCard", () => {
  it("shows the page heading", () => {
    render(<ApiHealthCard state="healthy" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Web Skeleton" }),
    ).toBeInTheDocument();
  });

  it.each<ApiHealthState>(["healthy", "unavailable"])(
    "reports the API as %s",
    (state) => {
      render(<ApiHealthCard state={state} />);

      expect(screen.getByText("API live state:")).toHaveTextContent(
        `API live state: ${state}`,
      );
    },
  );

  it.each<ApiHealthState>(["healthy", "unavailable"])(
    "has no accessibility violations when %s",
    async (state) => {
      const { container } = render(<ApiHealthCard state={state} />);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
