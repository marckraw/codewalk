import { describe, expect, it } from "vitest";
import { evaluateRepositoryReviewAccess } from "./repository-review-access";

describe("evaluateRepositoryReviewAccess", () => {
  it("allows repositories under the allowed owner by default", () => {
    expect(
      evaluateRepositoryReviewAccess({ allowedOwner: "ef-global", owner: "EF-Global", repo: "design", rules: [] }),
    ).toEqual({ allowed: true, source: "allowed-owner" });
  });

  it("allows outside repositories with an allow rule, case-insensitively", () => {
    expect(
      evaluateRepositoryReviewAccess({
        allowedOwner: "ef-global",
        owner: "Acme",
        repo: "Widgets",
        rules: [{ owner: "acme", repo: "widgets", rule: "allow" }],
      }),
    ).toEqual({ allowed: true, source: "allowlist" });
  });

  it("ignores outside repositories without an allow rule", () => {
    expect(
      evaluateRepositoryReviewAccess({ allowedOwner: "ef-global", owner: "acme", repo: "widgets", rules: [] }),
    ).toEqual({ allowed: false, reason: "not-allowlisted" });
  });

  it("blocks repositories with a block rule, even under the allowed owner", () => {
    expect(
      evaluateRepositoryReviewAccess({
        allowedOwner: "ef-global",
        owner: "ef-global",
        repo: "noisy-repo",
        rules: [{ owner: "ef-global", repo: "noisy-repo", rule: "block" }],
      }),
    ).toEqual({ allowed: false, reason: "blocklisted" });
  });

  it("only matches rules for the same repository", () => {
    expect(
      evaluateRepositoryReviewAccess({
        allowedOwner: "ef-global",
        owner: "acme",
        repo: "widgets",
        rules: [{ owner: "acme", repo: "other", rule: "allow" }],
      }),
    ).toEqual({ allowed: false, reason: "not-allowlisted" });
  });
});
