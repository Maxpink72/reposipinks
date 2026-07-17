import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  type TCreateResearchCodeInput,
  type TUpdateResearchCodeInput,
  ZCreateResearchCodeInput,
  ZUpdateResearchCodeInput,
} from "@/modules/research/types";

export const listResearchCodes = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);

  const codes = await prisma.researchCode.findMany({
    where: {
      researchProjectId,
      mergedIntoId: null,
    },
    include: {
      _count: { select: { segmentCodes: true } },
    },
    orderBy: { name: "asc" },
  });

  return codes;
});

export const createResearchCode = async (input: TCreateResearchCodeInput, actorId: string) => {
  const parsed = ZCreateResearchCodeInput.parse(input);

  try {
    const code = await prisma.$transaction(async (tx) => {
      const created = await tx.researchCode.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          name: parsed.name,
          description: parsed.description ?? null,
          color: parsed.color ?? "#64748b",
        },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          actorId,
          action: "code_created",
          targetType: "research_code",
          targetId: created.id,
          metadata: { name: created.name },
        },
      });
      return created;
    });
    return code;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new InvalidInputError("Code with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateResearchCode = async (
  codeId: string,
  input: TUpdateResearchCodeInput,
  actorId: string
) => {
  validateInputs([codeId, ZId]);
  const parsed = ZUpdateResearchCodeInput.parse(input);

  const existing = await prisma.researchCode.findUnique({
    where: { id: codeId },
    select: { id: true, researchProjectId: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchCode", codeId);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const code = await tx.researchCode.update({
        where: { id: codeId },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.color !== undefined ? { color: parsed.color } : {}),
        },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: existing.researchProjectId,
          actorId,
          action: "code_updated",
          targetType: "research_code",
          targetId: codeId,
        },
      });
      return code;
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new InvalidInputError("Code with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const mergeResearchCodes = async (params: {
  sourceCodeId: string;
  targetCodeId: string;
  actorId: string;
}) => {
  validateInputs([params.sourceCodeId, ZId], [params.targetCodeId, ZId]);
  if (params.sourceCodeId === params.targetCodeId) {
    throw new InvalidInputError("Cannot merge a code into itself");
  }

  const [source, target] = await Promise.all([
    prisma.researchCode.findUnique({ where: { id: params.sourceCodeId } }),
    prisma.researchCode.findUnique({ where: { id: params.targetCodeId } }),
  ]);

  if (!source) throw new ResourceNotFoundError("ResearchCode", params.sourceCodeId);
  if (!target) throw new ResourceNotFoundError("ResearchCode", params.targetCodeId);
  if (source.researchProjectId !== target.researchProjectId) {
    throw new InvalidInputError("Codes must belong to the same research project");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sourceLinks = await tx.researchTranscriptSegmentCode.findMany({
        where: { codeId: params.sourceCodeId },
        select: { segmentId: true },
      });

      for (const link of sourceLinks) {
        await tx.researchTranscriptSegmentCode.upsert({
          where: {
            segmentId_codeId: {
              segmentId: link.segmentId,
              codeId: params.targetCodeId,
            },
          },
          create: {
            segmentId: link.segmentId,
            codeId: params.targetCodeId,
            createdById: params.actorId,
          },
          update: {},
        });
      }

      await tx.researchTranscriptSegmentCode.deleteMany({
        where: { codeId: params.sourceCodeId },
      });

      await tx.researchCode.update({
        where: { id: params.sourceCodeId },
        data: { mergedIntoId: params.targetCodeId },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: source.researchProjectId,
          actorId: params.actorId,
          action: "code_merged",
          targetType: "research_code",
          targetId: params.targetCodeId,
          metadata: { sourceCodeId: params.sourceCodeId, sourceName: source.name },
        },
      });
    });

    return listResearchCodes(source.researchProjectId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const applyCodeToSegment = async (params: {
  segmentId: string;
  codeId: string;
  actorId: string;
}) => {
  validateInputs([params.segmentId, ZId], [params.codeId, ZId]);

  const [segment, code] = await Promise.all([
    prisma.researchTranscriptSegment.findUnique({
      where: { id: params.segmentId },
      include: {
        transcript: { select: { interview: { select: { researchProjectId: true, id: true } } } },
      },
    }),
    prisma.researchCode.findUnique({ where: { id: params.codeId } }),
  ]);

  if (!segment) throw new ResourceNotFoundError("ResearchTranscriptSegment", params.segmentId);
  if (!code) throw new ResourceNotFoundError("ResearchCode", params.codeId);
  if (code.researchProjectId !== segment.transcript.interview.researchProjectId) {
    throw new InvalidInputError("Code and segment must belong to the same research project");
  }
  if (code.mergedIntoId) {
    throw new InvalidInputError("Cannot apply a merged code");
  }

  try {
    const link = await prisma.$transaction(async (tx) => {
      const created = await tx.researchTranscriptSegmentCode.upsert({
        where: {
          segmentId_codeId: {
            segmentId: params.segmentId,
            codeId: params.codeId,
          },
        },
        create: {
          segmentId: params.segmentId,
          codeId: params.codeId,
          createdById: params.actorId,
        },
        update: {},
        include: { code: true },
      });

      // Promote interview status to coded when first code is applied
      await tx.researchInterview.update({
        where: { id: segment.transcript.interview.id },
        data: { status: "coded" },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: code.researchProjectId,
          actorId: params.actorId,
          action: "segment_coded",
          targetType: "transcript_segment",
          targetId: params.segmentId,
          metadata: { codeId: params.codeId, codeName: code.name },
        },
      });

      return created;
    });

    return link;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const removeCodeFromSegment = async (params: {
  segmentId: string;
  codeId: string;
  actorId: string;
}) => {
  validateInputs([params.segmentId, ZId], [params.codeId, ZId]);

  const link = await prisma.researchTranscriptSegmentCode.findUnique({
    where: {
      segmentId_codeId: {
        segmentId: params.segmentId,
        codeId: params.codeId,
      },
    },
    include: {
      code: true,
      segment: {
        include: {
          transcript: { select: { interview: { select: { researchProjectId: true } } } },
        },
      },
    },
  });

  if (!link) throw new ResourceNotFoundError("ResearchTranscriptSegmentCode", params.segmentId);

  await prisma.$transaction(async (tx) => {
    await tx.researchTranscriptSegmentCode.delete({
      where: {
        segmentId_codeId: {
          segmentId: params.segmentId,
          codeId: params.codeId,
        },
      },
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: link.segment.transcript.interview.researchProjectId,
        actorId: params.actorId,
        action: "segment_code_removed",
        targetType: "transcript_segment",
        targetId: params.segmentId,
        metadata: { codeId: params.codeId },
      },
    });
  });

  return { success: true };
};

export const getCodingMatrix = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);

  const [codes, interviews] = await Promise.all([
    prisma.researchCode.findMany({
      where: { researchProjectId, mergedIntoId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.researchInterview.findMany({
      where: { researchProjectId },
      select: {
        id: true,
        name: true,
        respondentSegment: true,
        transcript: {
          select: {
            segments: {
              select: {
                codes: { select: { codeId: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const themeByInterview = codes.map((code) => ({
    code,
    interviews: interviews.map((interview) => {
      const count =
        interview.transcript?.segments.reduce(
          (acc, seg) => acc + seg.codes.filter((c) => c.codeId === code.id).length,
          0
        ) ?? 0;
      return { interviewId: interview.id, interviewName: interview.name, count };
    }),
  }));

  const segments = Array.from(
    new Set(interviews.map((i) => i.respondentSegment).filter((s): s is string => Boolean(s)))
  );

  const themeBySegment = codes.map((code) => ({
    code,
    segments: segments.map((segment) => {
      const count = interviews
        .filter((i) => i.respondentSegment === segment)
        .reduce(
          (acc, interview) =>
            acc +
            (interview.transcript?.segments.reduce(
              (sAcc, seg) => sAcc + seg.codes.filter((c) => c.codeId === code.id).length,
              0
            ) ?? 0),
          0
        );
      return { segment, count };
    }),
  }));

  const codeFrequencies = await prisma.researchTranscriptSegmentCode.groupBy({
    by: ["codeId"],
    where: {
      code: { researchProjectId, mergedIntoId: null },
    },
    _count: { codeId: true },
  });

  return {
    codes,
    interviews: interviews.map((i) => ({
      id: i.id,
      name: i.name,
      respondentSegment: i.respondentSegment,
    })),
    segments,
    themeByInterview,
    themeBySegment,
    codeFrequencies: codeFrequencies.map((row) => ({
      codeId: row.codeId,
      count: row._count.codeId,
    })),
  };
});
