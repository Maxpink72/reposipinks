import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA,
  computeWeightedAuditScore,
  type TCreateResearchBrandAuditInput,
  type TResearchBrandAuditCompetitive,
  type TResearchBrandAuditPositioning,
  type TResearchBrandAuditStatus,
  type TResearchBrandAuditSwot,
  type TUpdateResearchBrandAuditInput,
  type TUpsertBrandAuditAssessmentInput,
  ZCreateResearchBrandAuditInput,
  ZResearchBrandAuditCompetitive,
  ZResearchBrandAuditPositioning,
  ZResearchBrandAuditSwot,
  ZUpdateResearchBrandAuditInput,
  ZUpsertBrandAuditAssessmentInput,
} from "@/modules/research/types/brand-audit";

const auditInclude = {
  brand: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  criteria: {
    orderBy: { position: "asc" as const },
    include: {
      assessments: {
        take: 1,
        include: { assessedBy: { select: { id: true, name: true } } },
      },
    },
  },
  assessments: {
    include: {
      criterion: { select: { id: true, key: true, name: true, weight: true, maxScore: true, category: true } },
      assessedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ResearchBrandAuditInclude;

export type TResearchBrandAuditDetail = Prisma.ResearchBrandAuditGetPayload<{
  include: typeof auditInclude;
}>;

export const listResearchBrandAudits = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);
  return prisma.researchBrandAudit.findMany({
    where: { researchProjectId, status: { not: "archived" } },
    include: {
      brand: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { criteria: true, assessments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
});

export const getResearchBrandAudit = reactCache(async (brandAuditId: string) => {
  validateInputs([brandAuditId, ZId]);
  return prisma.researchBrandAudit.findUnique({
    where: { id: brandAuditId },
    include: auditInclude,
  });
});

export const createResearchBrandAudit = async (
  input: TCreateResearchBrandAuditInput,
  actorId: string
): Promise<TResearchBrandAuditDetail> => {
  const parsed = ZCreateResearchBrandAuditInput.parse(input);
  const templateKey = parsed.templateKey ?? "agency_default";
  const criteria =
    templateKey === "agency_default"
      ? AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA
      : AGENCY_DEFAULT_BRAND_AUDIT_CRITERIA;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const audit = await tx.researchBrandAudit.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          brandId: parsed.brandId ?? null,
          name: parsed.name.trim(),
          notes: parsed.notes ?? null,
          templateKey,
          createdById: actorId,
          criteria: {
            create: criteria.map((c, index) => ({
              key: c.key,
              name: c.name,
              description: c.description,
              category: c.category,
              weight: c.weight,
              maxScore: c.maxScore,
              position: index,
            })),
          },
        },
        include: auditInclude,
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: parsed.researchProjectId,
          actorId,
          action: "brand_audit_created",
          targetType: "brand_audit",
          targetId: audit.id,
          metadata: { name: audit.name, templateKey },
        },
      });

      return audit;
    });

    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateResearchBrandAudit = async (
  input: TUpdateResearchBrandAuditInput,
  actorId: string
): Promise<TResearchBrandAuditDetail> => {
  const parsed = ZUpdateResearchBrandAuditInput.parse(input);
  const existing = await prisma.researchBrandAudit.findUnique({
    where: { id: parsed.brandAuditId },
    select: { id: true, researchProjectId: true, status: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchBrandAudit", parsed.brandAuditId);

  const data: Prisma.ResearchBrandAuditUpdateInput = {};
  if (parsed.name !== undefined) data.name = parsed.name.trim();
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.notes !== undefined) data.notes = parsed.notes;
  if (parsed.brandId !== undefined) {
    data.brand = parsed.brandId ? { connect: { id: parsed.brandId } } : { disconnect: true };
  }
  if (parsed.swot !== undefined) {
    data.swot = ZResearchBrandAuditSwot.parse(parsed.swot) as unknown as Prisma.InputJsonValue;
  }
  if (parsed.positioningMatrix !== undefined) {
    data.positioningMatrix = ZResearchBrandAuditPositioning.parse(
      parsed.positioningMatrix
    ) as unknown as Prisma.InputJsonValue;
  }
  if (parsed.competitiveMatrix !== undefined) {
    data.competitiveMatrix = ZResearchBrandAuditCompetitive.parse(
      parsed.competitiveMatrix
    ) as unknown as Prisma.InputJsonValue;
  }

  return prisma.$transaction(async (tx) => {
    const audit = await tx.researchBrandAudit.update({
      where: { id: parsed.brandAuditId },
      data,
      include: auditInclude,
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "brand_audit_updated",
        targetType: "brand_audit",
        targetId: audit.id,
        metadata: { status: audit.status },
      },
    });
    return audit;
  });
};

export const upsertBrandAuditAssessment = async (
  input: TUpsertBrandAuditAssessmentInput,
  actorId: string
) => {
  const parsed = ZUpsertBrandAuditAssessmentInput.parse(input);
  const criterion = await prisma.researchBrandAuditCriterion.findUnique({
    where: { id: parsed.criterionId },
    select: { id: true, brandAuditId: true, maxScore: true },
  });
  if (!criterion || criterion.brandAuditId !== parsed.brandAuditId) {
    throw new ResourceNotFoundError("ResearchBrandAuditCriterion", parsed.criterionId);
  }
  if (parsed.score > criterion.maxScore) {
    throw new InvalidInputError(`Score must be <= ${criterion.maxScore}`);
  }

  const audit = await prisma.researchBrandAudit.findUnique({
    where: { id: parsed.brandAuditId },
    select: { researchProjectId: true, status: true },
  });
  if (!audit) throw new ResourceNotFoundError("ResearchBrandAudit", parsed.brandAuditId);

  const result = await prisma.$transaction(async (tx) => {
    const assessment = await tx.researchBrandAuditAssessment.upsert({
      where: {
        brandAuditId_criterionId: {
          brandAuditId: parsed.brandAuditId,
          criterionId: parsed.criterionId,
        },
      },
      create: {
        brandAuditId: parsed.brandAuditId,
        criterionId: parsed.criterionId,
        score: parsed.score,
        comment: parsed.comment ?? null,
        assessedById: actorId,
        assessedAt: new Date(),
      },
      update: {
        score: parsed.score,
        comment: parsed.comment ?? null,
        assessedById: actorId,
        assessedAt: new Date(),
      },
    });

    if (audit.status === "draft") {
      await tx.researchBrandAudit.update({
        where: { id: parsed.brandAuditId },
        data: { status: "in_progress" },
      });
    }

    await tx.researchActivity.create({
      data: {
        researchProjectId: audit.researchProjectId,
        actorId,
        action: "brand_audit_assessed",
        targetType: "brand_audit_assessment",
        targetId: assessment.id,
        metadata: { criterionId: parsed.criterionId, score: parsed.score },
      },
    });

    return assessment;
  });

  return result;
};

export const deleteResearchBrandAudit = async (brandAuditId: string, actorId: string) => {
  const existing = await prisma.researchBrandAudit.findUnique({
    where: { id: brandAuditId },
    select: { id: true, researchProjectId: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchBrandAudit", brandAuditId);

  await prisma.$transaction(async (tx) => {
    await tx.researchBrandAudit.delete({ where: { id: brandAuditId } });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "brand_audit_deleted",
        targetType: "brand_audit",
        targetId: brandAuditId,
      },
    });
  });
};

export const getBrandAuditScoreSummary = (audit: TResearchBrandAuditDetail) => {
  const items = audit.assessments.map((a) => ({
    score: a.score,
    weight: a.criterion.weight,
    maxScore: a.criterion.maxScore,
  }));
  return computeWeightedAuditScore(items);
};

export const parseSwot = (raw: unknown): TResearchBrandAuditSwot =>
  ZResearchBrandAuditSwot.parse(raw ?? {});

export const parsePositioning = (raw: unknown): TResearchBrandAuditPositioning =>
  ZResearchBrandAuditPositioning.parse(raw ?? {});

export const parseCompetitive = (raw: unknown): TResearchBrandAuditCompetitive =>
  ZResearchBrandAuditCompetitive.parse(raw ?? {});

export type { TResearchBrandAuditStatus };
