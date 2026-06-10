import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

vi.mock("server-only", () => ({}));

vi.mock("@/entities/auth-server", () => ({
  getCurrentCodewalkUser: vi.fn(),
}));

vi.mock("@/entities/database", () => ({
  deleteRepositoryReviewRule: vi.fn(),
}));

import { getCurrentCodewalkUser } from "@/entities/auth-server";
import { deleteRepositoryReviewRule } from "@/entities/database";

describe("DELETE /api/settings/repository-rules/[ruleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "octocat@example.com",
      name: "Octocat",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(deleteRepositoryReviewRule).mockResolvedValue({ id: "rule-id" } as never);
  });

  it("deletes an existing rule", async () => {
    const response = await DELETE(deleteRequest(), routeContext("rule-id"));

    expect(response.status).toBe(200);
    expect(deleteRepositoryReviewRule).toHaveBeenCalledWith("rule-id");
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({ status: "signed-out" });

    const response = await DELETE(deleteRequest(), routeContext("rule-id"));

    expect(response.status).toBe(401);
    expect(deleteRepositoryReviewRule).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown rules", async () => {
    vi.mocked(deleteRepositoryReviewRule).mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), routeContext("missing-rule"));

    expect(response.status).toBe(404);
  });
});

function deleteRequest() {
  return new Request("http://localhost/api/settings/repository-rules/rule-id", { method: "DELETE" });
}

function routeContext(ruleId: string) {
  return { params: Promise.resolve({ ruleId }) };
}
