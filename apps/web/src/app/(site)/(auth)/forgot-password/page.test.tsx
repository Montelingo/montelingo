import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ForgotPasswordPage, { metadata } from "./page";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/server", () => ({ getCurrentUser }));

describe("ForgotPasswordPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Forgot your password?");
  });

  it("shows the form without checking the session", () => {
    render(<ForgotPasswordPage />);

    expect(
      screen.getByRole("form", { name: "Forgot your password?" }),
    ).toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
