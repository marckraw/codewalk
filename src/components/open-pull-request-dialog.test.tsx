import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OpenPullRequestDialog } from "./open-pull-request-dialog";

describe("OpenPullRequestDialog", () => {
  it("opens a focused PR URL dialog from the header command", async () => {
    render(<OpenPullRequestDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Open pull request" }));

    expect(screen.getByRole("dialog", { name: "Open pull request" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pull request URL")).toHaveAttribute("type", "url");
    expect(screen.getByRole("button", { name: "Import PR" })).toBeDisabled();
  });
});
