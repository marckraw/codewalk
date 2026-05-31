import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tabs } from "@/components/ui/tabs";

describe("ui primitives", () => {
  it("renders compact controls and review navigation state", () => {
    render(
      <Panel>
        <PanelHeader actions={<Badge tone="success">4 files</Badge>} title="Workspace" />
        <Tabs
          active="Guide"
          items={[
            { id: "Activity", label: "Activity" },
            { id: "Guide", label: "Guide" },
          ]}
        />
        <Button variant="primary">Sign in</Button>
      </Panel>,
    );

    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("4 files")).toBeInTheDocument();
    expect(screen.getByText("Guide")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
