import type { ReviewWorkspaceData } from "@/entities/database";

export type ReviewMode = "guide" | "diff";
export type ReviewWorkspace = ReviewWorkspaceData;
export type ReviewFile = ReviewWorkspaceData["files"][number];
export type ReviewGuide = NonNullable<ReviewWorkspaceData["guide"]>;
export type ReviewGuideSection = ReviewGuide["sections"][number];
export type ReviewGuideFile = ReviewGuideSection["files"][number];
export type ReviewRiskLevel = ReviewGuideSection["riskLevel"];
