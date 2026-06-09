import { describe, expect, it, vi } from "vitest";
import { deriveReviewWorkspaceState } from "./review-workspace";

vi.mock("server-only", () => ({}));

describe("deriveReviewWorkspaceState", () => {
  it("distinguishes imported, preparing, ready, and failed review states", () => {
    expect(deriveReviewWorkspaceState({ generation: null, guide: null })).toBe("imported");
    expect(deriveReviewWorkspaceState({ generation: { status: "running" }, guide: null })).toBe("preparing");
    expect(deriveReviewWorkspaceState({ generation: { status: "ready" }, guide: { status: "ready" } })).toBe("ready");
    expect(deriveReviewWorkspaceState({ generation: { status: "failed" }, guide: null })).toBe("failed");
    expect(deriveReviewWorkspaceState({ generation: null, guide: { status: "failed" } })).toBe("failed");
  });
});
