import { describe, expect, it } from "vitest";
import { isProtectedAppPath, PROTECTED_ROUTE_PATTERNS } from "./protected-routes";

describe("protected routes", () => {
  it("marks review surfaces as protected", () => {
    expect(PROTECTED_ROUTE_PATTERNS).toEqual(["/review(.*)"]);
    expect(isProtectedAppPath("/review")).toBe(true);
    expect(isProtectedAppPath("/review/abc123")).toBe(true);
  });

  it("leaves the landing, OAuth callback, and API surfaces public to route-level auth", () => {
    expect(isProtectedAppPath("/")).toBe(false);
    expect(isProtectedAppPath("/sso-callback")).toBe(false);
    expect(isProtectedAppPath("/api/import")).toBe(false);
  });
});
