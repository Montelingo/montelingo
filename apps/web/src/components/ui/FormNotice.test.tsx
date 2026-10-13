import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FormNotice } from "./FormNotice";

describe("FormNotice", () => {
  it("shows its message as a status, not an alert", () => {
    render(<FormNotice message="Password updated — please sign in." />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Password updated — please sign in.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([undefined, null, ""])(
    "renders nothing when the message is %j",
    (message) => {
      const { container } = render(<FormNotice message={message} />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("has no accessibility violations", async () => {
    const { container } = render(
      <FormNotice message="Password updated — please sign in." />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
