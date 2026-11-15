import { randomUUID } from "node:crypto";

import {
  expect,
  request,
  test,
  type APIRequestContext,
} from "@playwright/test";

const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

type MapState = "locked" | "available" | "in-progress" | "completed";

type ProgressState = {
  regions: Array<{ id: string; state: MapState }>;
  locations: Array<{ id: string; state: MapState }>;
};

async function createAndSignIn(
  context: APIRequestContext,
  email: string,
  password: string,
) {
  const signUp = await context.post("/api/v1/auth/sign-up", {
    headers: { Origin: WEB_URL },
    data: { email, password },
  });
  expect(signUp.status(), `Registration for ${email}`).toBe(201);

  const signIn = await context.post("/api/v1/auth/sign-in", {
    headers: { Origin: WEB_URL },
    data: { email, password },
  });
  expect(signIn.status(), `Sign-in for ${email}`).toBe(200);

  const me = await context.get("/api/v1/auth/me");
  expect(me.status()).toBe(200);

  const user = (await me.json()) as { id: string; email: string };
  expect(user.id).toBeTruthy();
  expect(user.email).toBe(email);
  return user;
}

test.describe("Issue #105: account isolation and signed-out access", () => {
  test("a second account has an independent starting state", async () => {
    const first = await request.newContext({ baseURL: WEB_URL });
    const second = await request.newContext({ baseURL: WEB_URL });

    try {
      const id = randomUUID();
      const password = `Test-password-${id}`;
      const firstEmail = `e2e-first-${id}@example.com`;
      const secondEmail = `e2e-second-${id}@example.com`;

      const firstUser = await createAndSignIn(first, firstEmail, password);
      const secondUser = await createAndSignIn(second, secondEmail, password);
      expect(firstUser.id).not.toBe(secondUser.id);

      const [firstResponse, secondResponse] = await Promise.all([
        first.get("/api/v1/progress"),
        second.get("/api/v1/progress"),
      ]);
      expect(firstResponse.status()).toBe(200);
      expect(secondResponse.status()).toBe(200);

      const firstProgress = (await firstResponse.json()) as ProgressState;
      const secondProgress = (await secondResponse.json()) as ProgressState;

      // Two distinct sessions both start at the same default state.
      expect(firstProgress).toEqual(secondProgress);
      for (const progress of [firstProgress, secondProgress]) {
        expect(progress.regions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "coast", state: "available" }),
          ]),
        );
        expect(progress.locations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "budva", state: "available" }),
          ]),
        );
      }

      const [firstMeAgain, secondMeAgain] = await Promise.all([
        first.get("/api/v1/auth/me"),
        second.get("/api/v1/auth/me"),
      ]);
      expect(firstMeAgain.status()).toBe(200);
      expect(secondMeAgain.status()).toBe(200);
      expect((await firstMeAgain.json()).id).toBe(firstUser.id);
      expect((await secondMeAgain.json()).id).toBe(secondUser.id);
    } finally {
      await first.dispose();
      await second.dispose();
    }
  });

  test("signed-out visitor is redirected from /play", async ({ page }) => {
    await page.goto("/play");
    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  });

  test("signed-out request to /api/v1/regions returns 401", async () => {
    const anonymous = await request.newContext({ baseURL: WEB_URL });

    try {
      const response = await anonymous.get("/api/v1/regions");
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});
