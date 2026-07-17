import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  type TCreateInsightFromSegmentInput,
  type TCreateResearchInsightInput,
  type TInsightListFilters,
  ZCreateInsightFromSegmentInput,
  ZCreateResearchInsightInput,
  ZInsightListFilters,
} from "@/modules/research/types";

const insightInclude = {
  author: { select: { id: true, name: true, email: true } },
  evidence: {
    include: {
      interview: { select: { id: true, name: true } },
      segment: { select: { id: true, text: true, speaker: true } },
    },
  },
} satisfies Prisma.ResearchInsightInclude;

export type TResearchInsightDetail = Prisma.ResearchInsightGetPayload<{
  include: typeof insightInclude;
}>;

export const listResearchInsights = reactCache(
  async (filters: TInsightListFilters): Promise<TResearchInsightDetail[]> => {
    const parsed = ZInsightListFilters.parse(filters);

    return prisma.researchInsight.findMany({
      where: {
        researchProjectId: parsed.researchProjectId,
        ...(parsed.type ? { type: parsed.type } : {}),
        ...(parsed.importance ? { importance: parsed.importance } : {}),
        ...(parsed.search
          ? {
              OR: [
                { title: { contains: parsed.search, mode: "insensitive" } },
                { description: { contains: parsed.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: insightInclude,
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });
  }
);

export const createResearchInsight = async (
  input: TCreateResearchInsightInput,
  actorId: string
): Promise<TResearchInsightDetail> => {
  const parsed = ZCreateResearchInsightInput.parse(input);

  try {
    const insight = await prisma.$transaction(async (tx) => {
      const created = await tx.researchInsight.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          title: parsed.title,
          description: parsed.description ?? null,
          type: parsed.type ?? "finding",
          confidence: parsed.confidence ?? "medium",
          importance: parsed.importance ?? "medium",
          tags: (parsed.tags ?? []) as Prisma.InputJsonValue,
          authorId: actorId,
          isAiGenerated: false,
          isHumanConfirmed: true,
        },
        select: { id: true },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          actorId,
          action: "insight_created",
          targetType: "insight",
          targetId: created.id,
          metadata: { title: parsed.title },
        },
      });

      return created;
    });

    const detail = await prisma.researchInsight.findUnique({
      where: { id: insight.id },
      include: insightInclude,
    });
    if (!detail) throw new ResourceNotFoundError("ResearchInsight", insight.id);
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createInsightFromSegment = async (
  input: TCreateInsightFromSegmentInput,
  actorId: string
): Promise<TResearchInsightDetail> => {
  const parsed = ZCreateInsightFromSegmentInput.parse(input);

  const segment = await prisma.researchTranscriptSegment.findUnique({
    where: { id: parsed.segmentId },
    include: {
      transcript: {
        select: {
          interview: {
            select: { id: true, researchProjectId: true },
          },
        },
      },
    },
  });

  if (!segment) throw new ResourceNotFoundError("ResearchTranscriptSegment", parsed.segmentId);
  if (segment.transcript.interview.researchProjectId !== parsed.researchProjectId) {
    throw new ResourceNotFoundError("ResearchTranscriptSegment", parsed.segmentId);
  }

  try {
    const insightId = await prisma.$transaction(async (tx) => {
      await tx.researchTranscriptSegment.update({
        where: { id: parsed.segmentId },
        data: { isQuote: true },
      });

      const insight = await tx.researchInsight.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          title: parsed.title,
          description: parsed.description ?? null,
          type: parsed.type ?? "finding",
          confidence: parsed.confidence ?? "medium",
          importance: parsed.importance ?? "medium",
          tags: (parsed.tags ?? []) as Prisma.InputJsonValue,
          authorId: actorId,
          isAiGenerated: false,
          isHumanConfirmed: true,
          evidence: {
            create: {
              interviewId: segment.transcript.interview.id,
              segmentId: segment.id,
              quoteText: segment.text,
            },
          },
        },
        select: { id: true },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          actorId,
          action: "insight_from_quote",
          targetType: "insight",
          targetId: insight.id,
          metadata: { segmentId: segment.id },
        },
      });

      return insight.id;
    });

    const detail = await prisma.researchInsight.findUnique({
      where: { id: insightId },
      include: insightInclude,
    });
    if (!detail) throw new ResourceNotFoundError("ResearchInsight", insightId);
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getResearchInsight = reactCache(async (insightId: string) => {
  validateInputs([insightId, ZId]);
  return prisma.researchInsight.findUnique({
    where: { id: insightId },
    include: insightInclude,
  });
});
