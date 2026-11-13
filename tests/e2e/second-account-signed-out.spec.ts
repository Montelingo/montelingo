
import { expect, test, request } from "@playwright/test";

const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

type MapState = "locked" | "available" | "in-progress" | "completed";

type ProgressState = {
  regions: Array<{ id: string; state: MapState }>;
  locations: Array<{ id: string; state: MapState }>;
};

test.describe("Issue #105: account isolation and signed-out access", () => {
  test("two accounts start independently", async () => {
    const first = await request.newContext({ baseURL: WEB_URL });
    const second = await request.newContext({ baseURL: WEB_URL });

    try {
      const runId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      const password = `Test-password-${runId}`;

      const firstEmail = `e2e-first-${runId}@example.com`;
      const secondEmail = `e2e-second-${runId}@example.com`;

      async function createAndSignIn(
        context: typeof first,
        email: string,
      ) {
        const signUp = await context.post("/api/v1/auth/sign-up", {
          headers: { Origin: WEB_URL },
          data: { email, password },
        });

        expect(signUp.status()).toBe(201);

        const signIn = await context.post("/api/v1/auth/sign-in", {
          headers: { Origin: WEB_URL },
          data: { email, password },
        });

        expect(signIn.status()).toBe(200);

        const me = await context.get("/api/v1/auth/me");

        expect(me.status()).toBe(200);

        const user = await me.json();
        expect(user.email).toBe(email);

        return user;
      }

      const firstUser = await createAndSignIn(first, firstEmail);
      const secondUser = await createAndSignIn(second, secondEmail);

      expect(firstUser.id).toBeTruthy();
      expect(secondUser.id).toBeTruthy();
      expect(firstUser.id).not.toBe(secondUser.id);

      const firstResponse = await first.get("/api/v1/progress");
      const secondResponse = await second.get("/api/v1/progress");

      expect(firstResponse.status()).toBe(200);
      expect(secondResponse.status()).toBe(200);

      const firstProgress =
        (await firstResponse.json()) as ProgressState;
      const secondProgress =
        (await secondResponse.json()) as ProgressState;

      expect(firstProgress).toEqual(secondProgress);

      expect(firstProgress.locations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "budva",
            state: "available",
          }),
        ]),
      );

      expect(firstProgress.regions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "coast",
            state: "available",
          }),
        ]),
      );

      const firstMeAgain = await first.get("/api/v1/auth/me");
      const secondMeAgain = await second.get("/api/v1/auth/me");

      expect((await firstMeAgain.json()).id).toBe(firstUser.id);
      expect((await secondMeAgain.json()).id).toBe(secondUser.id);
    } finally {
      await first.dispose();
      await second.dispose();
    }
  });

  test("signed-out visitor is redirected from /play", async ({
    page,
  }) => {
    await page.goto(`${WEB_URL}/play`);

    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  });

  test("signed-out request to /api/v1/regions returns 401", async () => {
    const anonymous = await request.newContext({
      baseURL: WEB_URL,
    });

    try {
      const response = await anonymous.get("/api/v1/regions");

      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});
