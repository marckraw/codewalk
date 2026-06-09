import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubClientError } from "@/lib/github/server/errors";
import { authorizeReviewSnapshotAccess } from "./review-authorization";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/pull-request-snapshots", () => ({
  getPullRequestSnapshotById: vi.fn(),
}));

vi.mock("@/lib/github/server/clerk-token", () => ({
  createCurrentUserGitHubRestClient: vi.fn(),
}));

import { getPullRequestSnapshotById } from "@/lib/db/pull-request-snapshots";
import { createCurrentUserGitHubRestClient } from "@/lib/github/server/clerk-token";

describe("authorizeReviewSnapshotAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue({
      id: "snapshot-id",
      owner: "ef-global",
      repo: "example",
    } as never);
    vi.mocked(createCurrentUserGitHubRestClient).mockResolvedValue({
      getRepository: vi.fn().mockResolvedValue({ full_name: "ef-global/example" }),
    } as never);
  });

  it("authorizes when the current GitHub user can access the repository", async () => {
    await expect(authorizeReviewSnapshotAccess("snapshot-id")).resolves.toMatchObject({
      ok: true,
      snapshot: {
        id: "snapshot-id",
      },
    });
  });

  it("returns not-found without touching GitHub when the snapshot is missing", async () => {
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(null);

    await expect(authorizeReviewSnapshotAccess("missing")).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(createCurrentUserGitHubRestClient).not.toHaveBeenCalled();
  });

  it("denies when GitHub token or repository access is missing", async () => {
    vi.mocked(createCurrentUserGitHubRestClient).mockResolvedValue({
      getRepository: vi.fn().mockRejectedValue(new GitHubClientError("not_found", "Not found.")),
    } as never);

    await expect(authorizeReviewSnapshotAccess("snapshot-id")).resolves.toEqual({
      ok: false,
      reason: "github-access-required",
    });
  });

  it("treats unexpected GitHub failures as unavailable", async () => {
    vi.mocked(createCurrentUserGitHubRestClient).mockResolvedValue({
      getRepository: vi.fn().mockRejectedValue(new GitHubClientError("rate_limited", "Rate limited.")),
    } as never);

    await expect(authorizeReviewSnapshotAccess("snapshot-id")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
