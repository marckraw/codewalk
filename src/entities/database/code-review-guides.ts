import "server-only";

import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  guideSectionFiles,
  guideSections,
  guides,
  type CodeReviewCacheIdentity,
  type CodeReviewGuideGenerator,
  type CodeReviewGuideMode,
  type CodeReviewGuideProvider,
  type CodeReviewGuidePullRequestMetadata,
  type CodeReviewGuideRiskLevel,
  type CodeReviewGuideStatus,
  type CodeReviewGuideSummary,
} from "./schema";

export type CodeReviewGuideFile = {
  path: string;
  status: string;
  reason: string;
  hunkHints: string[];
};

export type CodeReviewGuideSection = {
  id: string;
  title: string;
  summary: string;
  narrative: string;
  riskLevel: CodeReviewGuideRiskLevel;
  riskRationale: string;
  checklist: string[];
  files: CodeReviewGuideFile[];
};

export type CodeReviewGuide = {
  id: string;
  repository: string;
  pullRequestNumber: number;
  targetId: string;
  mode: CodeReviewGuideMode;
  cacheIdentity: CodeReviewCacheIdentity;
  provider: CodeReviewGuideProvider;
  model: string;
  effort: string | null;
  status: CodeReviewGuideStatus;
  overview: string;
  generatedBy: CodeReviewGuideGenerator;
  sections: CodeReviewGuideSection[];
  error: string | null;
  pullRequest: CodeReviewGuidePullRequestMetadata;
  summary: CodeReviewGuideSummary;
  createdAt: string;
  updatedAt: string;
};

export type PersistCodeReviewGuideInput = {
  snapshotId: string;
  guide: CodeReviewGuide;
};

export function buildCodeReviewGuideCacheKey(cacheIdentity: CodeReviewCacheIdentity): string {
  return JSON.stringify({
    comparisonRef: cacheIdentity.comparisonRef,
    comparisonPoint: cacheIdentity.comparisonPoint,
    workingTreeVersionToken: cacheIdentity.workingTreeVersionToken,
  });
}

export function buildCodeReviewGuideRows(input: PersistCodeReviewGuideInput) {
  const { guide, snapshotId } = input;

  return {
    guide: {
      cacheIdentity: guide.cacheIdentity,
      cacheKey: buildCodeReviewGuideCacheKey(guide.cacheIdentity),
      createdAt: new Date(guide.createdAt),
      daemonGuideId: guide.id,
      effort: guide.effort,
      error: guide.error,
      generatedBy: guide.generatedBy,
      mode: guide.mode,
      model: guide.model,
      overview: guide.overview,
      provider: guide.provider,
      pullRequest: guide.pullRequest,
      pullRequestNumber: guide.pullRequestNumber,
      repository: guide.repository,
      snapshotId,
      status: guide.status,
      summary: guide.summary,
      targetId: guide.targetId,
      updatedAt: new Date(guide.updatedAt),
    },
    sections: guide.sections.map((section, sectionIndex) => ({
      files: section.files.map((file, fileIndex) => ({
        hunkHints: file.hunkHints,
        order: fileIndex,
        path: file.path,
        reason: file.reason,
        status: file.status,
      })),
      section: {
        checklist: section.checklist,
        daemonSectionId: section.id,
        narrative: section.narrative,
        order: sectionIndex,
        riskLevel: section.riskLevel,
        riskRationale: section.riskRationale,
        summary: section.summary,
        title: section.title,
      },
    })),
  };
}

export async function persistCodeReviewGuide(input: PersistCodeReviewGuideInput) {
  const db = getDb();
  const rows = buildCodeReviewGuideRows(input);

  return db.transaction(async (tx) => {
    const [guide] = await tx
      .insert(guides)
      .values(rows.guide)
      .onConflictDoUpdate({
        set: {
          cacheIdentity: rows.guide.cacheIdentity,
          daemonGuideId: rows.guide.daemonGuideId,
          effort: rows.guide.effort,
          error: rows.guide.error,
          generatedBy: rows.guide.generatedBy,
          model: rows.guide.model,
          overview: rows.guide.overview,
          provider: rows.guide.provider,
          pullRequest: rows.guide.pullRequest,
          pullRequestNumber: rows.guide.pullRequestNumber,
          repository: rows.guide.repository,
          status: rows.guide.status,
          summary: rows.guide.summary,
          targetId: rows.guide.targetId,
          updatedAt: rows.guide.updatedAt,
        },
        target: [guides.snapshotId, guides.mode, guides.cacheKey],
      })
      .returning();

    if (rows.sections.length === 0) {
      await tx.delete(guideSections).where(eq(guideSections.guideId, guide.id));
      return guide;
    }

    const daemonSectionIds = rows.sections.map(({ section }) => section.daemonSectionId);

    await tx
      .delete(guideSections)
      .where(and(eq(guideSections.guideId, guide.id), notInArray(guideSections.daemonSectionId, daemonSectionIds)));

    for (const row of rows.sections) {
      const [section] = await tx
        .insert(guideSections)
        .values({ ...row.section, guideId: guide.id })
        .onConflictDoUpdate({
          set: {
            checklist: row.section.checklist,
            narrative: row.section.narrative,
            order: row.section.order,
            riskLevel: row.section.riskLevel,
            riskRationale: row.section.riskRationale,
            summary: row.section.summary,
            title: row.section.title,
          },
          target: [guideSections.guideId, guideSections.daemonSectionId],
        })
        .returning();

      await tx.delete(guideSectionFiles).where(eq(guideSectionFiles.guideSectionId, section.id));

      if (row.files.length > 0) {
        await tx
          .insert(guideSectionFiles)
          .values(row.files.map((file) => ({ ...file, guideSectionId: section.id })));
      }
    }

    return guide;
  });
}
