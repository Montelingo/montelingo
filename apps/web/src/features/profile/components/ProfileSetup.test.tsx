import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ProfileSetup } from "./ProfileSetup";

const saveProfile = vi.hoisted(() =>
  vi.fn<(update: unknown) => Promise<void>>(),
);
vi.mock("../api/profile-browser-api", () => ({ saveProfile }));

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const BUDVA = { name: "Budva", regionName: "Obala", order: 1 };

function renderSetup() {
  const user = userEvent.setup();
  const view = render(<ProfileSetup firstStop={BUDVA} />);
  return { user, ...view };
}

async function nameMia(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Ime djeteta"), "Mia");
  await user.click(screen.getByRole("button", { name: "Dalje" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  saveProfile.mockResolvedValue(undefined);
});

describe("ProfileSetup", () => {
  it("asks who is exploring first, with no Back", () => {
    renderSetup();

    expect(
      screen.getByRole("heading", { level: 1, name: "Ko istražuje?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Korak 1 od 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nazad" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Lisica" })).toBeChecked();
  });

  it("asks for a name when Next finds none", async () => {
    const { user } = renderSetup();

    await user.click(screen.getByRole("button", { name: "Dalje" }));

    const name = screen.getByLabelText("Ime djeteta");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Dodaj ime Ovo vidiš samo ti");
    expect(
      screen.getByRole("heading", { name: "Ko istražuje?" }),
    ).toBeVisible();
  });

  it("goes on to the age, named for the child, and back again", async () => {
    const { user } = renderSetup();

    await nameMia(user);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Koliko godina ima Mia?",
    });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Korak 2 od 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nazad" }));

    expect(screen.getByLabelText("Ime djeteta")).toHaveValue("Mia");
  });

  it("asks for an age band when Next finds none, and saves nothing", async () => {
    const { user } = renderSetup();
    await nameMia(user);

    await user.click(screen.getByRole("button", { name: "Dalje" }));

    expect(screen.getByText("Odaberi uzrast")).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("saves the profile, then is ready to explore from the first stop", async () => {
    const { user } = renderSetup();
    await user.click(screen.getByRole("radio", { name: "Sova" }));
    await nameMia(user);
    await user.click(screen.getByRole("radio", { name: /^5–6/ }));
    await user.click(screen.getByRole("button", { name: "Dalje" }));

    expect(saveProfile).toHaveBeenCalledWith({
      name: "Mia",
      age_band: "5-6",
      avatar: "owl",
    });
    expect(
      await screen.findByRole("heading", { name: "Spremni za istraživanje!" }),
    ).toHaveFocus();
    expect(screen.getByText("Prva stanica: Budva, Obala.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Krenimo!" }));

    expect(router.replace).toHaveBeenCalledWith("/play");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("saves only once when Next is pressed twice quickly", async () => {
    saveProfile.mockReturnValue(new Promise(() => {}));
    const { user } = renderSetup();
    await nameMia(user);
    await user.click(screen.getByRole("radio", { name: /^7/ }));

    const form = screen.getByRole("button", { name: "Dalje" }).closest("form");
    form?.requestSubmit();
    form?.requestSubmit();

    expect(saveProfile).toHaveBeenCalledTimes(1);
  });

  it("stays on the age step to try again when saving fails", async () => {
    saveProfile.mockRejectedValue(new Error("network"));
    const { user } = renderSetup();
    await nameMia(user);
    await user.click(screen.getByRole("radio", { name: /^7/ }));
    await user.click(screen.getByRole("button", { name: "Dalje" }));

    expect(
      await screen.findByText("Nije sačuvano. Pokušaj ponovo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dalje" })).toBeEnabled();
  });

  it("has no accessibility violations on either step", async () => {
    const { user, container } = renderSetup();
    expect(await axe(container)).toHaveNoViolations();

    await nameMia(user);
    expect(await axe(container)).toHaveNoViolations();
  });
});
