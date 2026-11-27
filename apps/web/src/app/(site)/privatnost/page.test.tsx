import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { PRIVACY_POLICY_VERSION } from "@/features/privacy/edge";

import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Politika privatnosti");
  });

  it("shows the policy with its version at the top", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Politika privatnosti" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Verzija ${PRIVACY_POLICY_VERSION}`),
    ).toBeInTheDocument();
  });

  it("covers what the policy must, under the title, in order", () => {
    render(<PrivacyPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Koje podatke prikupljamo",
      "Zašto ih prikupljamo",
      "Koliko dugo ih čuvamo",
      "Ko obrađuje podatke",
      "Vaša prava",
      "Kontakt",
    ]);
  });

  it("is in Montenegrin", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("main")).toHaveAttribute("lang", "sr-Latn-ME");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PrivacyPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
