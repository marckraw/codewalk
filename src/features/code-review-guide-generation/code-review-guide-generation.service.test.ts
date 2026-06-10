import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentsDaemonClientError } from "@/entities/agents-daemon";
import {
  CodeReviewGuideGenerationError,
  buildRepositoryUrlFromSnapshot,
  generateAndPersistCodeReviewGuide,
} from "./code-review-guide-generation.service";

vi.mock("server-only", () => ({}));

vi.mock("@/entities/agents-daemon", async () => {
  const actual = await vi.importActual<typeof import("@/entities/agents-daemon")>("@/entities/agents-daemon");

  return {
    ...actual,
    createAgentsDaemonClient: vi.fn(),
    getAgentsDaemonConfig: vi.fn(),
  };
});

vi.mock("@/entities/database", () => ({
  finishCodeReviewGuideGeneration: vi.fn(),
  getPullRequestSnapshotById: vi.fn(),
  persistCodeReviewGuide: vi.fn(),
  startCodeReviewGuideGeneration: vi.fn(),
}));

import { createAgentsDaemonClient } from "@/entities/agents-daemon";
import { getAgentsDaemonConfig } from "@/entities/agents-daemon";
import {
  finishCodeReviewGuideGeneration,
  startCodeReviewGuideGeneration,
} from "@/entities/database";
import { persistCodeReviewGuide } from "@/entities/database";
import { getPullRequestSnapshotById } from "@/entities/database";

describe("buildRepositoryUrlFromSnapshot", () => {
  it("builds the GitHub repository URL expected by agents-daemon", () => {
    expect(buildRepositoryUrlFromSnapshot({ owner: "ef-global", repo: "example" })).toBe(
      "https://github.com/ef-global/example",
    );
  });
});

describe("generateAndPersistCodeReviewGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(fixtureSnapshot as never);
    vi.mocked(getAgentsDaemonConfig).mockReturnValue({
      config: {
        apiToken: "daemon-token",
        baseUrl: "https://daemon.example.com",
        defaultEffort: "high",
        defaultModel: "gpt-5.4",
        defaultProvider: "codex",
        requestTimeoutMs: 240000,
      },
      ok: true,
    });
    vi.mocked(createAgentsDaemonClient).mockReturnValue({
      generateCodeReviewGuide: vi.fn().mockResolvedValue({ guide: fixtureGuide }),
    } as never);
    vi.mocked(startCodeReviewGuideGeneration).mockResolvedValue({ id: "generation-id" } as never);
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: null,
      guideId: "db-guide-id",
      id: "generation-id",
      status: "ready",
    } as never);
    vi.mocked(persistCodeReviewGuide).mockResolvedValue({ id: "db-guide-id", status: "ready" } as never);
  });

  it("generates a daemon guide for an imported snapshot and persists it", async () => {
    await expect(
      generateAndPersistCodeReviewGuide({
        force: true,
        requestedByUserId: "user-id",
        snapshotId: "snapshot-id",
      }),
    ).resolves.toMatchObject({
      generation: {
        id: "generation-id",
        status: "ready",
      },
      guide: {
        id: "db-guide-id",
      },
    });

    expect(startCodeReviewGuideGeneration).toHaveBeenCalledWith({
      effort: "high",
      force: true,
      model: "gpt-5.4",
      provider: "codex",
      requestedByUserId: "user-id",
      snapshotId: "snapshot-id",
    });
    expect(vi.mocked(createAgentsDaemonClient).mock.results[0]?.value.generateCodeReviewGuide).toHaveBeenCalledWith({
      effort: "high",
      force: true,
      model: "gpt-5.4",
      provider: "codex",
      pullRequestNumber: 42,
      repository: "https://github.com/ef-global/example",
    });
    expect(persistCodeReviewGuide).toHaveBeenCalledWith({
      guide: fixtureGuide,
      snapshotId: "snapshot-id",
    });
    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: null,
      guideId: "db-guide-id",
      snapshotId: "snapshot-id",
      status: "ready",
    });
  });

  it("fails before starting when the snapshot is missing", async () => {
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(null);

    await expect(
      generateAndPersistCodeReviewGuide({
        requestedByUserId: "user-id",
        snapshotId: "missing-snapshot",
      }),
    ).rejects.toMatchObject({
      code: "not-found",
      status: 404,
    } satisfies Partial<CodeReviewGuideGenerationError>);
    expect(startCodeReviewGuideGeneration).not.toHaveBeenCalled();
  });

  it("records configuration failures for an existing snapshot", async () => {
    vi.mocked(getAgentsDaemonConfig).mockReturnValue({
      message: "DEFAULT_GUIDE_MODEL is required for remote guided reviews.",
      missingKeys: ["DEFAULT_GUIDE_MODEL"],
      ok: false,
      state: "missing-default-model",
    });
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: "DEFAULT_GUIDE_MODEL is required for remote guided reviews.",
      guideId: null,
      id: "generation-id",
      status: "failed",
    } as never);

    await expect(
      generateAndPersistCodeReviewGuide({
        requestedByUserId: "user-id",
        snapshotId: "snapshot-id",
      }),
    ).rejects.toMatchObject({
      code: "configuration",
      status: 503,
    } satisfies Partial<CodeReviewGuideGenerationError>);

    expect(startCodeReviewGuideGeneration).toHaveBeenCalledWith({
      effort: null,
      force: false,
      model: null,
      provider: null,
      requestedByUserId: "user-id",
      snapshotId: "snapshot-id",
    });
    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: "DEFAULT_GUIDE_MODEL is required for remote guided reviews.",
      guideId: null,
      snapshotId: "snapshot-id",
      status: "failed",
    });
  });

  it("records daemon failures", async () => {
    vi.mocked(createAgentsDaemonClient).mockReturnValue({
      generateCodeReviewGuide: vi
        .fn()
        .mockRejectedValue(new AgentsDaemonClientError("network-error", "Could not reach agents-daemon.")),
    } as never);
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: "Could not reach agents-daemon.",
      guideId: null,
      id: "generation-id",
      status: "failed",
    } as never);

    await expect(
      generateAndPersistCodeReviewGuide({
        requestedByUserId: "user-id",
        snapshotId: "snapshot-id",
      }),
    ).rejects.toMatchObject({
      code: "daemon",
      message: "Could not reach agents-daemon.",
      status: 503,
    } satisfies Partial<CodeReviewGuideGenerationError>);

    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: "Could not reach agents-daemon.",
      guideId: null,
      snapshotId: "snapshot-id",
      status: "failed",
    });
  });
});

const fixtureSnapshot = {
  id: "snapshot-id",
  number: 42,
  owner: "ef-global",
  repo: "example",
};

const pullRequest = {
  baseBranch: "main",
  headBranch: "feature",
  headRepositoryName: "example",
  headRepositoryOwner: "ef-global",
  number: 42,
  provider: "github" as const,
  repositoryName: "example",
  repositoryOwner: "ef-global",
  state: "open" as const,
  title: "Add guided review",
  url: "https://github.com/ef-global/example/pull/42",
};

const cacheIdentity = {
  comparisonPoint: "base-sha",
  comparisonRef: "main",
  workingTreeVersionToken: "head-sha",
};

const fixtureGuide = {
  cacheIdentity,
  createdAt: "2026-06-09T08:00:00.000Z",
  effort: "high",
  error: null,
  generatedBy: "agent" as const,
  id: "daemon-guide-id",
  mode: "pull-request" as const,
  model: "gpt-5.4",
  overview: "Review persistence.",
  provider: "codex" as const,
  pullRequest,
  pullRequestNumber: 42,
  repository: "https://github.com/ef-global/example",
  sections: [],
  status: "ready" as const,
  summary: {
    cacheIdentity,
    files: [],
  },
  targetId: "pull-request:https://github.com/ef-global/example#42",
  updatedAt: "2026-06-09T08:01:00.000Z",
};
