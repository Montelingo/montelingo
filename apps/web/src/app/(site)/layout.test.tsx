import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SiteLayout from "./layout";

// The real header streams the session lookup; SiteHeader.test.tsx covers it.
vi.mock("@/features/auth/server", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

describe("SiteLayout", () => {
  it("puts the site header above the page", () => {
    render(
      <SiteLayout>
        <main id="main-content">Page</main>
      </SiteLayout>,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Site header");
    expect(
      header.compareDocumentPosition(screen.getByRole("main")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
