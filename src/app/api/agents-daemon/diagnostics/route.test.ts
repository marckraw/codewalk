import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/server", () => ({
  getCurrentCodewalkUser: vi.fn(),
}));

vi.mock("@/lib/agents-daemon/client", () => ({
  checkAgentsDaemonConnection: vi.fn(),
}));

import { checkAgentsDaemonConnection } from "@/lib/agents-daemon/client";
import { getCurrentCodewalkUser } from "@/lib/auth/server";

describe("GET /api/agents-daemon/diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "reviewer@example.com",
      name: "Reviewer",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(checkAgentsDaemonConnection).mockResolvedValue({
      baseUrl: "https://daemon.example.com",
      health: null,
      message: "Connected to agents-daemon.",
      meta: null,
      ok: true,
      state: "connected",
    });
  });

  it("returns daemon diagnostics for authenticated users", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      baseUrl: "https://daemon.example.com",
      health: null,
      message: "Connected to agents-daemon.",
      meta: null,
      ok: true,
      state: "connected",
    });
  });

  it("requires Clerk authentication", async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({ status: "signed-out" });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(checkAgentsDaemonConnection).not.toHaveBeenCalled();
  });

  it("returns 503 when daemon configuration or connection is unhealthy", async () => {
    vi.mocked(checkAgentsDaemonConnection).mockResolvedValue({
      baseUrl: null,
      health: null,
      message: "AGENTS_DAEMON_BASE_URL is required for remote guided reviews.",
      meta: null,
      ok: false,
      state: "missing-base-url",
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      state: "missing-base-url",
    });
  });
});
