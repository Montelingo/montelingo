import { live_api_v1_health_live_get } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getApiHealthState } from "./health-api";

vi.mock("@app/api-client", () => ({
  live_api_v1_health_live_get: vi.fn(),
}));

const liveHealth = vi.mocked(live_api_v1_health_live_get);

describe("getApiHealthState", () => {
  beforeEach(() => {
    liveHealth.mockReset();
  });

  it("returns healthy when the API reports ok", async () => {
    liveHealth.mockResolvedValue({ status: "ok" });

    await expect(getApiHealthState()).resolves.toBe("healthy");
  });

  it("returns unavailable when the API reports another status", async () => {
    liveHealth.mockResolvedValue({ status: "degraded" });

    await expect(getApiHealthState()).resolves.toBe("unavailable");
  });

  it("returns unavailable when the request fails", async () => {
    liveHealth.mockRejectedValue(new Error("connection refused"));

    await expect(getApiHealthState()).resolves.toBe("unavailable");
  });
});
