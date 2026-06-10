import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import type { ReviewWorkspace } from "./review-types";

export function WorkspaceStatusBadge({ workspace }: { workspace: ReviewWorkspace }) {
  switch (workspace.state) {
    case "ready":
      return (
        <Badge tone="success">
          <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
          ready
        </Badge>
      );
    case "failed":
      return <Badge tone="danger">failed</Badge>;
    case "preparing":
      return <Badge tone="warning">preparing</Badge>;
    case "imported":
      return <Badge tone="muted">imported</Badge>;
  }
}
