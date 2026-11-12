import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { SkeletonCard } from "./SkeletonCard";
import { SkeletonScreen } from "./SkeletonScreen";
import { SkeletonTextLine } from "./SkeletonTextLine";

function renderSkeleton() {
  return render(
    <SkeletonScreen>
      <SkeletonTextLine className="w-48 text-3xl" />
      <SkeletonCard>
        <SkeletonTextLine className="w-3/4 text-lg" />
      </SkeletonCard>
    </SkeletonScreen>,
  );
}

describe("SkeletonScreen", () => {
  it("is busy, and says it is loading once", () => {
    const { container } = renderSkeleton();

    expect(screen.getByRole("status")).toHaveTextContent(/^Loading…$/);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("keeps its blocks from screen readers, so they hear only that", () => {
    const { container } = renderSkeleton();

    const status = screen.getByRole("status");
    const blocks = Array.from(
      container.firstElementChild?.children ?? [],
    ).filter((block) => block !== status);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSkeleton();

    expect(await axe(container)).toHaveNoViolations();
  });
});
