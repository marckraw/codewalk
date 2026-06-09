import { describe, expect, it } from "vitest";
import {
  isTerminalReviewWorkspaceState,
  shouldPollReviewWorkspace,
} from "./use-review-workspace-live.pure";

describe("isTerminalReviewWorkspaceState", () => {
  it("treats ready and failed as terminal", () => {
    expect(isTerminalReviewWorkspaceState("ready")).toBe(true);
    expect(isTerminalReviewWorkspaceState("failed")).toBe(true);
  });

  it("treats imported and preparing as non-terminal", () => {
    expect(isTerminalReviewWorkspaceState("imported")).toBe(false);
    expect(isTerminalReviewWorkspaceState("preparing")).toBe(false);
  });
});

describe("shouldPollReviewWorkspace", () => {
  it("polls while a guide is preparing", () => {
    expect(shouldPollReviewWorkspace("preparing", false)).toBe(true);
  });

  it("polls when a generation request is pending even if still imported", () => {
    expect(shouldPollReviewWorkspace("imported", true)).toBe(true);
  });

  it("does not poll an idle imported workspace", () => {
    expect(shouldPollReviewWorkspace("imported", false)).toBe(false);
  });

  it("never polls a terminal workspace, even when pending", () => {
    expect(shouldPollReviewWorkspace("ready", true)).toBe(false);
    expect(shouldPollReviewWorkspace("failed", true)).toBe(false);
  });
});
