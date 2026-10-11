import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import RootLayout from "./layout";

// The real header streams the session lookup; SiteHeader.test.tsx covers it.
vi.mock("@/features/auth/server", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

// RootLayout renders <html> and <body>, which Testing Library cannot mount, so
// it is rendered to markup and its body is shown in the test document.
function renderLayout() {
  const markup = renderToStaticMarkup(
    <RootLayout>
      <main id="main-content">Page</main>
    </RootLayout>,
  );
  const page = new DOMParser().parseFromString(markup, "text/html");
  document.body.innerHTML = page.body.innerHTML;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("RootLayout", () => {
  it("puts the site header above every page", () => {
    renderLayout();

    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Site header");
    expect(
      header.compareDocumentPosition(screen.getByRole("main")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("starts with a link that skips to the page's main content", () => {
    renderLayout();

    const skipLink = screen.getAllByRole("link")[0];
    expect(skipLink).toHaveTextContent("Skip to content");
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).toBe(
      screen.getByRole("main"),
    );
  });
});
