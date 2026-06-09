import { describe, expect, it } from "vitest";
import { buildPierrePatch } from "./pierre-diff-viewer";

describe("buildPierrePatch", () => {
  it("wraps GitHub hunk-only patches with file headers", () => {
    expect(buildPierrePatch({ diff: "@@ -1 +1 @@\n-old\n+new", file: "src/app.ts" })).toBe(
      ["diff --git a/src/app.ts b/src/app.ts", "--- a/src/app.ts", "+++ b/src/app.ts", "@@ -1 +1 @@\n-old\n+new"].join("\n"),
    );
  });

  it("keeps full git patches unchanged", () => {
    const patch = ["diff --git a/src/app.ts b/src/app.ts", "--- a/src/app.ts", "+++ b/src/app.ts", "@@ -1 +1 @@"].join("\n");

    expect(buildPierrePatch({ diff: patch, file: "src/app.ts" })).toBe(patch);
  });

  it("returns null when there is no hunk", () => {
    expect(buildPierrePatch({ diff: "Binary files differ", file: "image.png" })).toBeNull();
  });
});
