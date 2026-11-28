import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CheckboxField } from "./CheckboxField";

describe("CheckboxField", () => {
  it("is a checkbox named by its label", () => {
    render(<CheckboxField label="Prihvatam uslove." />);

    expect(
      screen.getByRole("checkbox", { name: "Prihvatam uslove." }),
    ).not.toBeChecked();
  });

  it("toggles when the label text is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CheckboxField label="Prihvatam uslove." onChange={onChange} />);

    await user.click(screen.getByText("Prihvatam uslove."));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("puts the box in a 48px square inside a row at least 48px tall", () => {
    render(<CheckboxField label="Prihvatam uslove." />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.parentElement).toHaveClass("size-touch");
    expect(checkbox.closest("label")).toHaveClass("min-h-touch");
  });

  it("announces its error with the checkbox and marks it invalid", () => {
    render(
      <CheckboxField label="Prihvatam uslove." error="Prihvati uslove." />,
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription("Prihvati uslove.");
  });

  it("is not marked invalid without an error", () => {
    render(<CheckboxField label="Prihvatam uslove." />);

    expect(screen.getByRole("checkbox")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("checkbox")).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("has no accessibility violations, with or without an error", async () => {
    const { container, rerender } = render(
      <CheckboxField
        label={
          <>
            Prihvatam <a href="/uslovi">uslove</a>.
          </>
        }
      />,
    );
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <CheckboxField
        label={
          <>
            Prihvatam <a href="/uslovi">uslove</a>.
          </>
        }
        error="Prihvati uslove."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
