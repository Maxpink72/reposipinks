import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { executeChartDefinition } from "@/modules/research/lib/analysis/execute-chart";
import {
  type TResearchChartDefinition,
  type TResearchChartResult,
  ZResearchChartDefinition,
} from "@/modules/research/types/chart-definition";

const blockInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  dataset: { select: { id: true, name: true, sourceType: true, rowCount: true } },
} satisfies Prisma.ResearchAnalysisBlockInclude;

export type TResearchAnalysisBlockDetail = Prisma.ResearchAnalysisBlockGetPayload<{
  include: typeof blockInclude;
}>;

export const listResearchAnalysisBlocks = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);
  return prisma.researchAnalysisBlock.findMany({
    where: { researchProjectId },
    include: blockInclude,
    orderBy: { updatedAt: "desc" },
  });
});

export const getResearchAnalysisBlock = reactCache(async (blockId: string) => {
  validateInputs([blockId, ZId]);
  return prisma.researchAnalysisBlock.findUnique({
    where: { id: blockId },
    include: blockInclude,
  });
});

export const createResearchAnalysisBlock = async (params: {
  researchProjectId: string;
  title: string;
  description?: string;
  analystComment?: string;
  chartDefinition: TResearchChartDefinition;
  actorId: string;
}): Promise<{ block: TResearchAnalysisBlockDetail; result: TResearchChartResult }> => {
  const chartDefinition = ZResearchChartDefinition.parse({
    ...params.chartDefinition,
    id: params.chartDefinition.id || createId(),
  });

  const result = await executeChartDefinition(chartDefinition);
  const datasetId =
    chartDefinition.dataset.kind === "dataset_field" ? chartDefinition.dataset.datasetId : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const block = await tx.researchAnalysisBlock.create({
        data: {
          researchProjectId: params.researchProjectId,
          title: params.title.trim(),
          description: params.description ?? null,
          analystComment: params.analystComment ?? null,
          chartDefinition: chartDefinition as unknown as Prisma.InputJsonValue,
          lastResult: result as unknown as Prisma.InputJsonValue,
          datasetId,
          createdById: params.actorId,
        },
        include: blockInclude,
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: params.researchProjectId,
          actorId: params.actorId,
          action: "analysis_block_created",
          targetType: "analysis_block",
          targetId: block.id,
          metadata: { title: block.title, chartType: chartDefinition.type },
        },
      });

      return block;
    });

    return { block: created, result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const refreshResearchAnalysisBlock = async (
  blockId: string,
  actorId: string
): Promise<{ block: TResearchAnalysisBlockDetail; result: TResearchChartResult }> => {
  validateInputs([blockId, ZId]);

  const existing = await prisma.researchAnalysisBlock.findUnique({ where: { id: blockId } });
  if (!existing) throw new ResourceNotFoundError("ResearchAnalysisBlock", blockId);

  const chartDefinition = ZResearchChartDefinition.parse(existing.chartDefinition);
  const result = await executeChartDefinition(chartDefinition);

  const block = await prisma.$transaction(async (tx) => {
    const updated = await tx.researchAnalysisBlock.update({
      where: { id: blockId },
      data: { lastResult: result as unknown as Prisma.InputJsonValue },
      include: blockInclude,
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "analysis_block_refreshed",
        targetType: "analysis_block",
        targetId: blockId,
      },
    });
    return updated;
  });

  return { block, result };
};

export const deleteResearchAnalysisBlock = async (blockId: string, actorId: string) => {
  validateInputs([blockId, ZId]);
  const existing = await prisma.researchAnalysisBlock.findUnique({
    where: { id: blockId },
    select: { id: true, researchProjectId: true, title: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchAnalysisBlock", blockId);

  await prisma.$transaction(async (tx) => {
    await tx.researchAnalysisBlock.delete({ where: { id: blockId } });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "analysis_block_deleted",
        targetType: "analysis_block",
        targetId: blockId,
        metadata: { title: existing.title },
      },
    });
  });

  return { success: true };
};

export const previewChartDefinition = async (
  chartDefinition: TResearchChartDefinition
): Promise<TResearchChartResult> => executeChartDefinition(ZResearchChartDefinition.parse(chartDefinition));
