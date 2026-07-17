import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { parseTranscriptText } from "@/modules/research/lib/transcript-parser";
import {
  type TCreateResearchInterviewInput,
  type TImportTranscriptInput,
  type TInterviewListFilters,
  type TTranscriptSearchInput,
  type TUpdateResearchInterviewInput,
  ZCreateResearchInterviewInput,
  ZImportTranscriptInput,
  ZInterviewListFilters,
  ZTranscriptSearchInput,
  ZUpdateResearchInterviewInput,
} from "@/modules/research/types";

const interviewListInclude = {
  interviewer: { select: { id: true, name: true, email: true } },
  transcript: { select: { id: true, updatedAt: true, _count: { select: { segments: true } } } },
  _count: { select: { insightEvidence: true } },
} satisfies Prisma.ResearchInterviewInclude;

export type TResearchInterviewListItem = Prisma.ResearchInterviewGetPayload<{
  include: typeof interviewListInclude;
}>;

export type TResearchInterviewDetail = Prisma.ResearchInterviewGetPayload<{
  include: {
    interviewer: { select: { id: true; name: true; email: true } };
    transcript: {
      include: {
        segments: {
          include: {
            codes: { include: { code: true } };
          };
          orderBy: { position: "asc" };
        };
      };
    };
  };
}>;

export const createResearchInterview = async (
  input: TCreateResearchInterviewInput,
  actorId: string
): Promise<TResearchInterviewDetail> => {
  const parsed = ZCreateResearchInterviewInput.parse(input);

  try {
    const interview = await prisma.$transaction(async (tx) => {
      const created = await tx.researchInterview.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          name: parsed.name,
          respondentName: parsed.respondentName ?? null,
          respondentSegment: parsed.respondentSegment ?? null,
          interviewerId: parsed.interviewerId ?? actorId,
          scheduledAt: parsed.scheduledAt ?? null,
          status: parsed.status ?? "planned",
          durationMinutes: parsed.durationMinutes ?? null,
          notes: parsed.notes ?? null,
          mediaUrl: parsed.mediaUrl ?? null,
          tags: (parsed.tags ?? []) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          actorId,
          action: "interview_created",
          targetType: "interview",
          targetId: created.id,
          metadata: { name: parsed.name },
        },
      });

      return created;
    });

    const detail = await getResearchInterview(interview.id);
    if (!detail) throw new ResourceNotFoundError("ResearchInterview", interview.id);
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const listResearchInterviews = reactCache(
  async (filters: TInterviewListFilters): Promise<TResearchInterviewListItem[]> => {
    const parsed = ZInterviewListFilters.parse(filters);

    const where: Prisma.ResearchInterviewWhereInput = {
      researchProjectId: parsed.researchProjectId,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.segment ? { respondentSegment: parsed.segment } : {}),
      ...(parsed.tag
        ? {
            tags: {
              array_contains: parsed.tag,
            },
          }
        : {}),
      ...(parsed.search
        ? {
            OR: [
              { name: { contains: parsed.search, mode: "insensitive" } },
              { respondentName: { contains: parsed.search, mode: "insensitive" } },
              { notes: { contains: parsed.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    try {
      return await prisma.researchInterview.findMany({
        where,
        include: interviewListInclude,
        orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getResearchInterview = reactCache(
  async (interviewId: string): Promise<TResearchInterviewDetail | null> => {
    validateInputs([interviewId, ZId]);

    try {
      return await prisma.researchInterview.findUnique({
        where: { id: interviewId },
        include: {
          interviewer: { select: { id: true, name: true, email: true } },
          transcript: {
            include: {
              segments: {
                include: {
                  codes: { include: { code: true } },
                },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const updateResearchInterview = async (
  interviewId: string,
  input: TUpdateResearchInterviewInput,
  actorId: string
): Promise<TResearchInterviewDetail> => {
  validateInputs([interviewId, ZId]);
  const parsed = ZUpdateResearchInterviewInput.parse(input);

  const existing = await prisma.researchInterview.findUnique({
    where: { id: interviewId },
    select: { id: true, researchProjectId: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchInterview", interviewId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.researchInterview.update({
        where: { id: interviewId },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.respondentName !== undefined ? { respondentName: parsed.respondentName } : {}),
          ...(parsed.respondentSegment !== undefined
            ? { respondentSegment: parsed.respondentSegment }
            : {}),
          ...(parsed.interviewerId !== undefined
            ? {
                interviewer: parsed.interviewerId
                  ? { connect: { id: parsed.interviewerId } }
                  : { disconnect: true },
              }
            : {}),
          ...(parsed.scheduledAt !== undefined ? { scheduledAt: parsed.scheduledAt } : {}),
          ...(parsed.status !== undefined
            ? {
                status: parsed.status,
                completedAt:
                  parsed.status === "completed" ||
                  parsed.status === "transcribed" ||
                  parsed.status === "coded" ||
                  parsed.status === "analyzed"
                    ? new Date()
                    : undefined,
              }
            : {}),
          ...(parsed.durationMinutes !== undefined ? { durationMinutes: parsed.durationMinutes } : {}),
          ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
          ...(parsed.mediaUrl !== undefined ? { mediaUrl: parsed.mediaUrl } : {}),
          ...(parsed.tags !== undefined ? { tags: parsed.tags as Prisma.InputJsonValue } : {}),
        },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: existing.researchProjectId,
          actorId,
          action: "interview_updated",
          targetType: "interview",
          targetId: interviewId,
          metadata: { fields: Object.keys(parsed) },
        },
      });
    });

    const detail = await getResearchInterview(interviewId);
    if (!detail) throw new ResourceNotFoundError("ResearchInterview", interviewId);
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const importInterviewTranscript = async (
  input: TImportTranscriptInput,
  actorId: string
): Promise<TResearchInterviewDetail> => {
  const parsed = ZImportTranscriptInput.parse(input);
  const segments = parseTranscriptText(parsed.rawText);

  const interview = await prisma.researchInterview.findUnique({
    where: { id: parsed.interviewId },
    select: { id: true, researchProjectId: true },
  });
  if (!interview) throw new ResourceNotFoundError("ResearchInterview", parsed.interviewId);

  try {
    await prisma.$transaction(async (tx) => {
      const transcript = await tx.researchTranscript.upsert({
        where: { interviewId: parsed.interviewId },
        create: {
          interviewId: parsed.interviewId,
          rawText: parsed.rawText,
          language: parsed.language ?? "ru-RU",
          source: parsed.source ?? "paste",
        },
        update: {
          rawText: parsed.rawText,
          language: parsed.language ?? "ru-RU",
          source: parsed.source ?? "paste",
        },
      });

      await tx.researchTranscriptSegmentCode.deleteMany({
        where: { segment: { transcriptId: transcript.id } },
      });
      await tx.researchTranscriptSegment.deleteMany({
        where: { transcriptId: transcript.id },
      });

      if (segments.length > 0) {
        await tx.researchTranscriptSegment.createMany({
          data: segments.map((seg) => ({
            transcriptId: transcript.id,
            position: seg.position,
            speaker: seg.speaker,
            text: seg.text,
          })),
        });
      }

      await tx.researchInterview.update({
        where: { id: parsed.interviewId },
        data: { status: "transcribed" },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: interview.researchProjectId,
          actorId,
          action: "transcript_imported",
          targetType: "interview",
          targetId: parsed.interviewId,
          metadata: { segmentCount: segments.length },
        },
      });
    });

    const detail = await getResearchInterview(parsed.interviewId);
    if (!detail) throw new ResourceNotFoundError("ResearchInterview", parsed.interviewId);
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateTranscriptSegment = async (params: {
  segmentId: string;
  notes?: string | null;
  isQuote?: boolean;
  actorId: string;
}) => {
  validateInputs([params.segmentId, ZId]);

  const segment = await prisma.researchTranscriptSegment.findUnique({
    where: { id: params.segmentId },
    include: {
      transcript: { select: { interview: { select: { researchProjectId: true, id: true } } } },
    },
  });
  if (!segment) throw new ResourceNotFoundError("ResearchTranscriptSegment", params.segmentId);

  try {
    const updated = await prisma.researchTranscriptSegment.update({
      where: { id: params.segmentId },
      data: {
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
        ...(params.isQuote !== undefined ? { isQuote: params.isQuote } : {}),
      },
      include: {
        codes: { include: { code: true } },
      },
    });

    await prisma.researchActivity.create({
      data: {
        researchProjectId: segment.transcript.interview.researchProjectId,
        actorId: params.actorId,
        action: "segment_updated",
        targetType: "transcript_segment",
        targetId: params.segmentId,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const searchTranscriptSegments = reactCache(async (input: TTranscriptSearchInput) => {
  const parsed = ZTranscriptSearchInput.parse(input);

  return prisma.researchTranscriptSegment.findMany({
    where: {
      text: { contains: parsed.query, mode: "insensitive" },
      transcript: {
        interview: {
          researchProjectId: parsed.researchProjectId,
          ...(parsed.interviewId ? { id: parsed.interviewId } : {}),
          ...(parsed.segment ? { respondentSegment: parsed.segment } : {}),
          ...(parsed.tag
            ? {
                tags: { array_contains: parsed.tag },
              }
            : {}),
        },
      },
    },
    include: {
      transcript: {
        select: {
          interview: {
            select: { id: true, name: true, respondentSegment: true },
          },
        },
      },
      codes: { include: { code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
});
