import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenPullRequestDialog } from "./open-pull-request-dialog";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

describe("OpenPullRequestDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    routerPush.mockClear();
  });

  it("opens a focused PR URL dialog from the header command", async () => {
    render(<OpenPullRequestDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Open pull request" }));

    expect(screen.getByRole("dialog", { name: "Open pull request" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pull request URL")).toHaveAttribute("type", "url");
    expect(screen.getByRole("button", { name: "Import PR" })).toBeEnabled();
  });

  it("shows a user-facing error before submitting unsupported URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<OpenPullRequestDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Open pull request" }));
    await userEvent.type(screen.getByLabelText("Pull request URL"), "https://gitlab.com/org/repo/pull/1");
    await userEvent.click(screen.getByRole("button", { name: "Import PR" }));

    expect(await screen.findByText("Only github.com pull request URLs are supported in the MVP.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits valid GitHub PR URLs to the import route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        counts: { comments: 2, commits: 3, files: 4 },
        pullRequest: { owner: "openai", repo: "codex", number: 24 },
        snapshot: { headSha: "head-sha", id: "snapshot-id" },
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    render(<OpenPullRequestDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Open pull request" }));
    await userEvent.type(screen.getByLabelText("Pull request URL"), "https://github.com/openai/codex/pull/24");
    await userEvent.click(screen.getByRole("button", { name: "Import PR" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/pull-requests/import",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Imported openai/codex#24 with 4 files, 3 commits, and 2 comments.")).toBeInTheDocument();
    expect(routerPush).toHaveBeenCalledWith("/review/snapshot-id?generate=1");
  });
});
