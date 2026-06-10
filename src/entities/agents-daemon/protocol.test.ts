import { describe, expect, it } from "vitest";
import {
  buildAgentsDaemonGenerateGuideRequestBody,
  buildAgentsDaemonUrl,
  parseAgentsDaemonGenerateGuideResult,
  parseAgentsDaemonHealth,
  parseAgentsDaemonMeta,
  resolveAgentsDaemonBaseUrl,
} from "./protocol";

describe("agents-daemon protocol", () => {
  it("normalizes base URLs and builds absolute endpoint URLs", () => {
    expect(resolveAgentsDaemonBaseUrl("https://daemon.example.com/path/?debug=1#hash")).toEqual({
      baseUrl: "https://daemon.example.com/path",
      ok: true,
    });
    expect(resolveAgentsDaemonBaseUrl("")).toEqual({ ok: false, reason: "missing" });
    expect(resolveAgentsDaemonBaseUrl("file:///tmp/daemon")).toEqual({ ok: false, reason: "invalid" });
    expect(buildAgentsDaemonUrl("https://daemon.example.com/", "/v0/meta")).toBe(
      "https://daemon.example.com/v0/meta",
    );
  });

  it("builds the daemon guide generation request body", () => {
    expect(
      buildAgentsDaemonGenerateGuideRequestBody({
        effort: " high ",
        force: true,
        model: " gpt-5.4 ",
        provider: "codex",
        pullRequestNumber: 42,
        repository: " https://github.com/ef-global/example ",
      }),
    ).toEqual({
      effort: "high",
      force: true,
      model: "gpt-5.4",
      provider: "codex",
      source: {
        pullRequest: {
          number: 42,
        },
        repository: "https://github.com/ef-global/example",
      },
    });
  });

  it("parses health and meta responses", () => {
    expect(parseAgentsDaemonHealth(healthPayload)).toEqual(healthPayload);
    expect(parseAgentsDaemonMeta(metaPayload)).toEqual(metaPayload);
  });

  it("parses the canonical guide generation response", () => {
    const result = parseAgentsDaemonGenerateGuideResult(generatePayload);

    expect(result.guide).toMatchObject({
      generatedBy: "agent",
      id: "guide-1",
      mode: "pull-request",
      overview: "Review persistence and API boundaries.",
      provider: "codex",
      status: "ready",
    });
    expect(result.guide.sections[0]).toMatchObject({
      files: [
        {
          hunkHints: ["@@ -1 +1 @@"],
          path: "src/lib/db/schema.ts",
          reason: "Guide schema changed.",
          status: "modified",
        },
      ],
      id: "section-1",
      riskLevel: "medium",
      riskRationale: "Persistence contract changed.",
    });
  });

  it("rejects invalid guide payloads", () => {
    expect(() =>
      parseAgentsDaemonGenerateGuideResult({
        ...generatePayload,
        guide: {
          ...generatePayload.guide,
          overview: { purpose: "old shape" },
        },
      }),
    ).toThrow("Invalid guide.overview");
  });
});

const healthPayload = {
  activeSessions: 1,
  apiVersion: "v0",
  providers: {
    codex: true,
  },
  status: "ok" as const,
  uptime: 12,
  version: "1.0.0",
};

const metaPayload = {
  apiVersion: "v0",
  deployment: {
    mode: "shared",
    sharedAcrossTeams: true,
  },
  git: {
    githubAuthenticated: true,
  },
  name: "agents-daemon",
  providers: [],
  runtime: {
    activeSessions: 1,
    host: "127.0.0.1",
    maxConcurrentAgents: 4,
    port: 3001,
    uptimeSeconds: 12,
  },
  version: "1.0.0",
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

const summary = {
  cacheIdentity,
  files: [
    {
      file: "src/lib/db/schema.ts",
      status: "modified",
    },
  ],
};

const generatePayload = {
  guide: {
    cacheIdentity,
    createdAt: "2026-06-09T08:00:00.000Z",
    effort: null,
    error: null,
    generatedBy: "agent",
    id: "guide-1",
    mode: "pull-request",
    model: "gpt-5.4",
    overview: "Review persistence and API boundaries.",
    provider: "codex",
    pullRequest,
    pullRequestNumber: 42,
    repository: "https://github.com/ef-global/example",
    sections: [
      {
        checklist: ["Check migration.", "Check renderer assumptions."],
        files: [
          {
            hunkHints: ["@@ -1 +1 @@"],
            path: "src/lib/db/schema.ts",
            reason: "Guide schema changed.",
            status: "modified",
          },
        ],
        id: "section-1",
        narrative: "The persistence model now follows agents-daemon.",
        riskLevel: "medium",
        riskRationale: "Persistence contract changed.",
        summary: "Guide schema changed.",
        title: "Guide persistence",
      },
    ],
    status: "ready",
    summary,
    targetId: "pull-request:https://github.com/ef-global/example#42",
    updatedAt: "2026-06-09T08:01:00.000Z",
  },
  pullRequest,
  summary,
};
