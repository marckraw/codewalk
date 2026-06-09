import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeReviewGuideGenerationError } from "@/lib/code-review-guide-generation";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentCodewalkUser: vi.fn(),
}));

vi.mock("@/lib/db/users", () => ({
  upsertAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/code-review-guide-generation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/code-review-guide-generation")>(
    "@/lib/code-review-guide-generation",
  );

  return {
    ...actual,
    generateAndPersistCodeReviewGuide: vi.fn(),
  };
});

import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { generateAndPersistCodeReviewGuide } from "@/lib/code-review-guide-generation";
import { upsertAuthenticatedUser } from "@/lib/db/users";

describe("POST /api/code-review-guides/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "reviewer@example.com",
      name: "Reviewer",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(upsertAuthenticatedUser).mockResolvedValue({ id: "db-user-id" } as never);
    vi.mocked(generateAndPersistCodeReviewGuide).mockResolvedValue({
      generation: {
        error: null,
        guideId: "guide-id",
        id: "generation-id",
        status: "ready",
      },
      guide: {
        id: "guide-id",
        status: "ready",
      },
    } as never);
  });

  it("generates a guide for an imported snapshot", async () => {
    const response = await POST(jsonRequest({ force: true, snapshotId: "snapshot-id" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generation: {
        error: null,
        guideId: "guide-id",
        id: "generation-id",
        status: "ready",
      },
      guide: {
        id: "guide-id",
        status: "ready",
      },
      status: "ready",
    });
    expect(generateAndPersistCodeReviewGuide).toHaveBeenCalledWith({
      force: true,
      requestedByUserId: "db-user-id",
      snapshotId: "snapshot-id",
    });
  });

  it("validates request body before touching auth", async () => {
    const response = await POST(jsonRequest({ snapshotId: "" }));

    expect(response.status).toBe(400);
    expect(getCurrentCodewalkUser).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({ status: "signed-out" });

    const response = await POST(jsonRequest({ snapshotId: "snapshot-id" }));

    expect(response.status).toBe(401);
    expect(generateAndPersistCodeReviewGuide).not.toHaveBeenCalled();
  });

  it("maps generation errors to API responses", async () => {
    vi.mocked(generateAndPersistCodeReviewGuide).mockRejectedValue(
      new CodeReviewGuideGenerationError("daemon", "Could not reach agents-daemon.", 503),
    );

    const response = await POST(jsonRequest({ snapshotId: "snapshot-id" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "daemon",
      error: "Could not reach agents-daemon.",
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/code-review-guides/generate", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
