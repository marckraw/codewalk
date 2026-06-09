import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  codeReviewGuideGenerations,
  guideSectionFiles,
  guideSections,
  guides,
  pullRequestFiles,
  pullRequestSnapshots,
  type CodeReviewGuideGenerationRow,
  type CodeReviewGuideRow,
  type CodeReviewGuideSectionFileRow,
  type CodeReviewGuideSectionRow,
} from "./schema";

export type ReviewWorkspaceState = "imported" | "preparing" | "ready" | "failed";

export type ReviewWorkspaceGuideSection = CodeReviewGuideSectionRow & {
  files: CodeReviewGuideSectionFileRow[];
};

export type ReviewWorkspaceGuide = CodeReviewGuideRow & {
  sections: ReviewWorkspaceGuideSection[];
};

export type ReviewWorkspaceData = {
  files: Array<typeof pullRequestFiles.$inferSelect>;
  generation: CodeReviewGuideGenerationRow | null;
  guide: ReviewWorkspaceGuide | null;
  snapshot: typeof pullRequestSnapshots.$inferSelect;
  state: ReviewWorkspaceState;
};

export function deriveReviewWorkspaceState(input: {
  generation: Pick<CodeReviewGuideGenerationRow, "status"> | null;
  guide: Pick<CodeReviewGuideRow, "status"> | null;
}): ReviewWorkspaceState {
  if (input.generation?.status === "failed" || input.guide?.status === "failed") {
    return "failed";
  }

  if (input.guide?.status === "ready") {
    return "ready";
  }

  if (input.generation?.status === "running") {
    return "preparing";
  }

  return "imported";
}

export async function getReviewWorkspace(snapshotId: string): Promise<ReviewWorkspaceData | null> {
  const db = getDb();
  const [snapshot] = await db
    .select()
    .from(pullRequestSnapshots)
    .where(eq(pullRequestSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) {
    return null;
  }

  const [files, generation] = await Promise.all([
    db.select().from(pullRequestFiles).where(eq(pullRequestFiles.snapshotId, snapshotId)).orderBy(asc(pullRequestFiles.path)),
    db.query.codeReviewGuideGenerations.findFirst({
      orderBy: desc(codeReviewGuideGenerations.updatedAt),
      where: eq(codeReviewGuideGenerations.snapshotId, snapshotId),
    }),
  ]);

  const guide = await getWorkspaceGuide({
    generation: generation ?? null,
    snapshotId,
  });

  return {
    files,
    generation: generation ?? null,
    guide,
    snapshot,
    state: deriveReviewWorkspaceState({
      generation: generation ?? null,
      guide,
    }),
  };
}

async function getWorkspaceGuide(input: {
  generation: CodeReviewGuideGenerationRow | null;
  snapshotId: string;
}): Promise<ReviewWorkspaceGuide | null> {
  const db = getDb();
  const guide = input.generation?.guideId
    ? await db.query.guides.findFirst({
        where: eq(guides.id, input.generation.guideId),
      })
    : await db.query.guides.findFirst({
        orderBy: desc(guides.updatedAt),
        where: eq(guides.snapshotId, input.snapshotId),
      });

  if (!guide) {
    return null;
  }

  const sections = await db
    .select()
    .from(guideSections)
    .where(eq(guideSections.guideId, guide.id))
    .orderBy(asc(guideSections.order));

  if (sections.length === 0) {
    return { ...guide, sections: [] };
  }

  const sectionFiles = await db
    .select()
    .from(guideSectionFiles)
    .where(
      inArray(
        guideSectionFiles.guideSectionId,
        sections.map((section) => section.id),
      ),
    )
    .orderBy(asc(guideSectionFiles.order));
  const filesBySectionId = new Map<string, CodeReviewGuideSectionFileRow[]>();

  for (const file of sectionFiles) {
    const current = filesBySectionId.get(file.guideSectionId) ?? [];
    current.push(file);
    filesBySectionId.set(file.guideSectionId, current);
  }

  return {
    ...guide,
    sections: sections.map((section) => ({
      ...section,
      files: filesBySectionId.get(section.id) ?? [],
    })),
  };
}
