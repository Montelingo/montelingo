import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { LearnerHomePlaceholder } from "./LearnerHomePlaceholder";

describe("LearnerHomePlaceholder", () => {
  it("says the map is on its way, with nothing to press", () => {
    render(<LearnerHomePlaceholder />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your map is on its way")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnerHomePlaceholder />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
