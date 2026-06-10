import { Badge } from "@/components/ui/badge";
import type { PullRequestLifecycleStatus } from "@/lib/github/pull-request-lifecycle.pure";

const PR_STATUS_LABEL: Record<PullRequestLifecycleStatus, string> = {
  closed: "closed",
  draft: "draft",
  merged: "merged",
  ready_for_review: "ready for review",
  unknown: "unknown",
};

const PR_STATUS_TONE: Record<PullRequestLifecycleStatus, "success" | "warning" | "danger" | "muted"> = {
  closed: "danger",
  draft: "warning",
  merged: "success",
  ready_for_review: "success",
  unknown: "muted",
};

export function PullRequestStatusBadge({ status }: { status: PullRequestLifecycleStatus }) {
  return <Badge tone={PR_STATUS_TONE[status]}>{PR_STATUS_LABEL[status]}</Badge>;
}
