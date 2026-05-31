import { describe, expect, it } from "vitest";
import { isProtectedAppPath, PROTECTED_ROUTE_PATTERNS } from "./protected-routes";

describe("protected routes", () => {
  it("marks review and API surfaces as protected", () => {
    expect(PROTECTED_ROUTE_PATTERNS).toEqual(["/review(.*)", "/api(.*)"]);
    expect(isProtectedAppPath("/review")).toBe(true);
    expect(isProtectedAppPath("/review/abc123")).toBe(true);
    expect(isProtectedAppPath("/api/import")).toBe(true);
  });

  it("leaves the landing and OAuth callback surfaces public", () => {
    expect(isProtectedAppPath("/")).toBe(false);
    expect(isProtectedAppPath("/sso-callback")).toBe(false);
  });
});
