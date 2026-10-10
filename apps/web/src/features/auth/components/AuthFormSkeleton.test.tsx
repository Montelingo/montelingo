import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { SignInFormSkeleton } from "./SignInFormSkeleton";
import { SignUpFormSkeleton } from "./SignUpFormSkeleton";

describe.each([
  ["SignInFormSkeleton", SignInFormSkeleton],
  ["SignUpFormSkeleton", SignUpFormSkeleton],
])("%s", (_name, Skeleton) => {
  it("announces that the page is loading", () => {
    render(<Skeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Skeleton />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
