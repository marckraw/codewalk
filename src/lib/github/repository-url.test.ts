import { describe, expect, it } from "vitest";
import { formatRepositoryRef, parseGitHubRepositoryInput } from "./repository-url";

describe("parseGitHubRepositoryInput", () => {
  it("parses a repository URL", () => {
    expect(parseGitHubRepositoryInput("https://github.com/acme/widgets")).toEqual({
      ok: true,
      repository: { owner: "acme", repo: "widgets" },
    });
  });

  it("parses deep links and trailing segments", () => {
    expect(parseGitHubRepositoryInput("https://github.com/acme/widgets/pull/123")).toEqual({
      ok: true,
      repository: { owner: "acme", repo: "widgets" },
    });
    expect(parseGitHubRepositoryInput("https://github.com/acme/widgets.git")).toEqual({
      ok: true,
      repository: { owner: "acme", repo: "widgets" },
    });
  });

  it("parses the owner/repo shorthand and bare github.com links", () => {
    expect(parseGitHubRepositoryInput("acme/widgets")).toEqual({
      ok: true,
      repository: { owner: "acme", repo: "widgets" },
    });
    expect(parseGitHubRepositoryInput("github.com/acme/widgets")).toEqual({
      ok: true,
      repository: { owner: "acme", repo: "widgets" },
    });
  });

  it("rejects unsupported input", () => {
    expect(parseGitHubRepositoryInput("")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("acme")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("acme/widgets/extra")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("http://github.com/acme/widgets")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("https://gitlab.com/acme/widgets")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("https://github.com/acme")).toMatchObject({ ok: false });
    expect(parseGitHubRepositoryInput("acme/wid gets")).toMatchObject({ ok: false });
  });
});

describe("formatRepositoryRef", () => {
  it("formats owner/repo", () => {
    expect(formatRepositoryRef({ owner: "acme", repo: "widgets" })).toBe("acme/widgets");
  });
});
