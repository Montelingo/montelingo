import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { FormAlert } from "./FormAlert";

describe("FormAlert", () => {
  it("announces its message as an alert", () => {
    render(<FormAlert message="Email or password is incorrect." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
  });

  it.each([undefined, null, ""])(
    "renders nothing when the message is %j",
    (message) => {
      const { container } = render(<FormAlert message={message} />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("appears when a message arrives after the first render", () => {
    const { rerender } = render(<FormAlert message={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<FormAlert message="Something went wrong. Try again." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <FormAlert message="Email or password is incorrect." />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
