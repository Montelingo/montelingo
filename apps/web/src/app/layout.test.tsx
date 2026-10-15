import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import RootLayout from "./layout";

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
  // The site pages get the header from (site)/layout.tsx; the learner area
  // is full screen without it.
  it("leaves the header to each section", () => {
    renderLayout();

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Page");
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
