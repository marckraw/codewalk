import { describe, expect, it } from "vitest";
import {
  buildReviewDeepLinkQuery,
  parseReviewDeepLink,
  parseReviewView,
} from "./review-deep-link.pure";

describe("parseReviewView", () => {
  it("accepts the known views", () => {
    expect(parseReviewView("guide")).toBe("guide");
    expect(parseReviewView("diff")).toBe("diff");
  });

  it("rejects anything else", () => {
    expect(parseReviewView("nope")).toBeNull();
    expect(parseReviewView(undefined)).toBeNull();
    expect(parseReviewView(null)).toBeNull();
  });
});

describe("parseReviewDeepLink", () => {
  it("reads view, section, and file", () => {
    expect(parseReviewDeepLink({ file: "src/foo.ts", section: "sec-1", view: "guide" })).toEqual({
      filePath: "src/foo.ts",
      sectionId: "sec-1",
      view: "guide",
    });
  });

  it("takes the first value for repeated params and trims", () => {
    expect(parseReviewDeepLink({ file: ["  src/a.ts  ", "src/b.ts"], view: ["diff"] })).toEqual({
      filePath: "src/a.ts",
      sectionId: null,
      view: "diff",
    });
  });

  it("treats blank and unknown values as absent", () => {
    expect(parseReviewDeepLink({ section: "   ", view: "weird" })).toEqual({
      filePath: null,
      sectionId: null,
      view: null,
    });
  });
});

describe("buildReviewDeepLinkQuery", () => {
  it("carries the section in guide view and ignores the file", () => {
    const query = buildReviewDeepLinkQuery({ filePath: "src/foo.ts", sectionId: "sec-1", view: "guide" });
    const params = new URLSearchParams(query);

    expect(params.get("view")).toBe("guide");
    expect(params.get("section")).toBe("sec-1");
    expect(params.get("file")).toBeNull();
  });

  it("carries the file in diff view and ignores the section", () => {
    const query = buildReviewDeepLinkQuery({ filePath: "src/foo.ts", sectionId: "sec-1", view: "diff" });
    const params = new URLSearchParams(query);

    expect(params.get("view")).toBe("diff");
    expect(params.get("file")).toBe("src/foo.ts");
    expect(params.get("section")).toBeNull();
  });

  it("emits only the view when no target is selected", () => {
    expect(buildReviewDeepLinkQuery({ filePath: null, sectionId: null, view: "guide" })).toBe("?view=guide");
  });
});
