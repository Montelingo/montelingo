import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { HomeScreen } from "./HomeScreen";

const SIGN_OUT = <button type="button">Odjavi se</button>;

const MIA = {
  name: "Mia",
  avatar: "owl",
  title: "Istraživač · 5–6 godina",
} as const;

describe("HomeScreen, signed out", () => {
  it("welcomes a family, as in Figma", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "visitor", canSignOut: false }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Istraži Crnu Goru, riječ po riječ",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Priče, zvuci i naljepnice za uzrast 3–7. Odrasla osoba prvo sve podesi.",
      ),
    ).toBeInTheDocument();
  });

  it("leads new families to sign up and others to sign in", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "visitor", canSignOut: false }}
      />,
    );

    expect(screen.getByRole("link", { name: "Nov sam" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getByRole("link", { name: "Imam nalog" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByRole("button", { name: "Odjavi se" })).toBeNull();
  });

  it("offers signing out when the account could not be looked up", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "visitor", canSignOut: true }}
      />,
    );

    expect(screen.getByRole("link", { name: "Nov sam" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "visitor", canSignOut: false }}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("HomeScreen, either way", () => {
  it.each([
    { status: "visitor", canSignOut: false },
    { status: "family", explorer: MIA },
  ] as const)("links to the privacy policy in its footer ($status)", (view) => {
    render(<HomeScreen signOut={SIGN_OUT} view={view} />);

    expect(
      screen.getByRole("link", { name: "Politika privatnosti" }),
    ).toHaveAttribute("href", "/privatnost");
  });
});

describe("HomeScreen, signed in", () => {
  it("shows the child and leads back to the map", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "family", explorer: MIA }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Dobro došli nazad!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mia")).toBeInTheDocument();
    expect(screen.getByText("Istraživač · 5–6 godina")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nastavi istraživanje" }),
    ).toHaveAttribute("href", "/play");
  });

  it("has the account and signing out for the grown-up", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "family", explorer: MIA }}
      />,
    );

    expect(screen.getByRole("link", { name: "Nalog" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(
      screen.getByRole("button", { name: "Odjavi se" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nov sam" })).toBeNull();
  });

  it("shows the placeholder explorer before the profile is set up", () => {
    render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "family", explorer: null }}
      />,
    );

    expect(screen.getByText("Istraživač")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nastavi istraživanje" }),
    ).toHaveAttribute("href", "/play");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <HomeScreen
        signOut={SIGN_OUT}
        view={{ status: "family", explorer: MIA }}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
