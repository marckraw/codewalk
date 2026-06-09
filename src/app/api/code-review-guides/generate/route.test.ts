import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeReviewGuideGenerationError } from "@/lib/code-review-guide-generation";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const afterTasks = vi.hoisted(() => [] as Array<() => unknown>);

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: vi.fn((task: () => unknown) => {
      afterTasks.push(task);
    }),
  };
});

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
    startCodeReviewGuideGenerationRun: vi.fn(),
  };
});

import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { startCodeReviewGuideGenerationRun } from "@/lib/code-review-guide-generation";
import { upsertAuthenticatedUser } from "@/lib/db/users";

describe("POST /api/code-review-guides/generate", () => {
  const complete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    afterTasks.length = 0;
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "reviewer@example.com",
      name: "Reviewer",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(upsertAuthenticatedUser).mockResolvedValue({ id: "db-user-id" } as never);
    complete.mockResolvedValue({} as never);
    vi.mocked(startCodeReviewGuideGenerationRun).mockResolvedValue({
      complete,
      generation: {
        error: null,
        guideId: null,
        id: "generation-id",
        status: "running",
      },
      snapshot: { id: "snapshot-id" },
    } as never);
  });

  it("starts a generation run and responds before it completes", async () => {
    const response = await POST(jsonRequest({ force: true, snapshotId: "snapshot-id" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      generation: {
        error: null,
        guideId: null,
        id: "generation-id",
        status: "running",
      },
      status: "preparing",
    });
    expect(startCodeReviewGuideGenerationRun).toHaveBeenCalledWith({
      force: true,
      requestedByUserId: "db-user-id",
      snapshotId: "snapshot-id",
    });
    // The daemon round-trip is deferred until after the response is sent.
    expect(complete).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);

    await flushAfterTasks();

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("swallows background completion failures (they are persisted on the row)", async () => {
    complete.mockRejectedValue(new CodeReviewGuideGenerationError("daemon", "boom", 502));

    const response = await POST(jsonRequest({ snapshotId: "snapshot-id" }));

    expect(response.status).toBe(202);
    await expect(flushAfterTasks()).resolves.not.toThrow();
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
    expect(startCodeReviewGuideGenerationRun).not.toHaveBeenCalled();
  });

  it("maps synchronous start errors to API responses", async () => {
    vi.mocked(startCodeReviewGuideGenerationRun).mockRejectedValue(
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

async function flushAfterTasks() {
  const tasks = [...afterTasks];
  afterTasks.length = 0;

  for (const task of tasks) {
    await task();
  }
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/code-review-guides/generate", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
