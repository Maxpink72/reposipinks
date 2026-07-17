import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  type TCreateResearchProjectInput,
  type TResearchMethodType,
  type TResearchProjectListFilters,
  type TUpdateResearchProjectInput,
  ZCreateResearchProjectInput,
  ZResearchProjectListFilters,
  ZUpdateResearchProjectInput,
} from "@/modules/research/types";

const DEFAULT_PAGE_SIZE = 24;

const projectListInclude = {
  client: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  _count: {
    select: {
      surveys: true,
      members: true,
    },
  },
} satisfies Prisma.ResearchProjectInclude;

export type TResearchProjectListItem = Prisma.ResearchProjectGetPayload<{
  include: typeof projectListInclude;
}>;

export type TResearchProjectDetail = Prisma.ResearchProjectGetPayload<{
  include: {
    client: true;
    brand: true;
    owner: { select: { id: true; name: true; email: true } };
    members: {
      include: { user: { select: { id: true; name: true; email: true } } };
    };
    surveys: {
      include: {
        survey: { select: { id: true; name: true; status: true; type: true; updatedAt: true } };
      };
    };
    _count: { select: { surveys: true; members: true; activity: true } };
  };
}>;

const ensureClient = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  clientId?: string,
  clientName?: string
): Promise<string | null> => {
  if (clientId) {
    const existing = await tx.researchClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new ResourceNotFoundError("ResearchClient", clientId);
    }
    return existing.id;
  }

  if (!clientName?.trim()) {
    return null;
  }

  const created = await tx.researchClient.upsert({
    where: {
      organizationId_name: {
        organizationId,
        name: clientName.trim(),
      },
    },
    create: {
      organizationId,
      name: clientName.trim(),
    },
    update: {},
    select: { id: true },
  });

  return created.id;
};

const ensureBrand = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  brandId?: string,
  brandName?: string,
  clientId?: string | null
): Promise<string | null> => {
  if (brandId) {
    const existing = await tx.researchBrand.findFirst({
      where: { id: brandId, organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new ResourceNotFoundError("ResearchBrand", brandId);
    }
    return existing.id;
  }

  if (!brandName?.trim()) {
    return null;
  }

  const created = await tx.researchBrand.upsert({
    where: {
      organizationId_name: {
        organizationId,
        name: brandName.trim(),
      },
    },
    create: {
      organizationId,
      name: brandName.trim(),
      clientId: clientId ?? null,
    },
    update: {
      clientId: clientId ?? undefined,
    },
    select: { id: true },
  });

  return created.id;
};

export const createResearchProject = async (
  input: TCreateResearchProjectInput,
  actorId: string
): Promise<TResearchProjectDetail> => {
  const parsed = ZCreateResearchProjectInput.parse(input);

  try {
    const projectId = await prisma.$transaction(async (tx) => {
      const clientId = await ensureClient(tx, parsed.organizationId, parsed.clientId, parsed.clientName);
      const brandId = await ensureBrand(
        tx,
        parsed.organizationId,
        parsed.brandId,
        parsed.brandName,
        clientId
      );

      const project = await tx.researchProject.create({
        data: {
          organizationId: parsed.organizationId,
          workspaceId: parsed.workspaceId ?? null,
          name: parsed.name,
          description: parsed.description ?? null,
          researchType: parsed.researchType ?? null,
          status: parsed.status ?? "draft",
          ownerId: actorId,
          clientId,
          brandId,
          methods: (parsed.methods ?? []) as Prisma.InputJsonValue,
          goals: (parsed.goals ?? []) as Prisma.InputJsonValue,
          researchQuestions: (parsed.researchQuestions ?? []) as Prisma.InputJsonValue,
          hypotheses: (parsed.hypotheses ?? []) as Prisma.InputJsonValue,
          startsAt: parsed.startsAt ?? null,
          endsAt: parsed.endsAt ?? null,
          members: {
            create: {
              userId: actorId,
              role: "owner",
            },
          },
        },
        select: { id: true },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: project.id,
          actorId,
          action: "created",
          targetType: "research_project",
          targetId: project.id,
          metadata: { name: parsed.name },
        },
      });

      return project.id;
    });

    const detail = await getResearchProject(projectId);
    if (!detail) {
      throw new ResourceNotFoundError("ResearchProject", projectId);
    }
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const listResearchProjects = reactCache(
  async (
    filters: TResearchProjectListFilters
  ): Promise<{ items: TResearchProjectListItem[]; total: number }> => {
    const parsed = ZResearchProjectListFilters.parse(filters);
    const page = parsed.page ?? 1;
    const pageSize = parsed.pageSize ?? DEFAULT_PAGE_SIZE;
    const sortBy = parsed.sortBy ?? "updatedAt";
    const sortOrder = parsed.sortOrder ?? "desc";

    const where: Prisma.ResearchProjectWhereInput = {
      organizationId: parsed.organizationId,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.clientId ? { clientId: parsed.clientId } : {}),
      ...(parsed.brandId ? { brandId: parsed.brandId } : {}),
      ...(parsed.ownerId ? { ownerId: parsed.ownerId } : {}),
      ...(parsed.researchType ? { researchType: parsed.researchType } : {}),
      ...(parsed.isFavorite !== undefined ? { isFavorite: parsed.isFavorite } : {}),
      ...(parsed.includeArchived
        ? {}
        : {
            status: parsed.status ?? { not: "archived" },
          }),
      ...(parsed.search
        ? {
            OR: [
              { name: { contains: parsed.search, mode: "insensitive" } },
              { description: { contains: parsed.search, mode: "insensitive" } },
              { researchType: { contains: parsed.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // If both status and includeArchived=false with status archived requested, honor explicit status
    if (parsed.status) {
      where.status = parsed.status;
    }

    try {
      const [items, total] = await prisma.$transaction([
        prisma.researchProject.findMany({
          where,
          include: projectListInclude,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.researchProject.count({ where }),
      ]);

      return { items, total };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getResearchProject = reactCache(
  async (researchProjectId: string): Promise<TResearchProjectDetail | null> => {
    validateInputs([researchProjectId, ZId]);

    try {
      return await prisma.researchProject.findUnique({
        where: { id: researchProjectId },
        include: {
          client: true,
          brand: true,
          owner: { select: { id: true, name: true, email: true } },
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
          },
          surveys: {
            include: {
              survey: { select: { id: true, name: true, status: true, type: true, updatedAt: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { surveys: true, members: true, activity: true } },
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

export const updateResearchProject = async (
  researchProjectId: string,
  input: TUpdateResearchProjectInput,
  actorId: string
): Promise<TResearchProjectDetail> => {
  validateInputs([researchProjectId, ZId]);
  const parsed = ZUpdateResearchProjectInput.parse(input);

  try {
    const data: Prisma.ResearchProjectUpdateInput = {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.researchType !== undefined ? { researchType: parsed.researchType } : {}),
      ...(parsed.status !== undefined
        ? {
            status: parsed.status,
            archivedAt: parsed.status === "archived" ? new Date() : null,
          }
        : {}),
      ...(parsed.clientId !== undefined
        ? { client: parsed.clientId ? { connect: { id: parsed.clientId } } : { disconnect: true } }
        : {}),
      ...(parsed.brandId !== undefined
        ? { brand: parsed.brandId ? { connect: { id: parsed.brandId } } : { disconnect: true } }
        : {}),
      ...(parsed.methods !== undefined
        ? { methods: parsed.methods as TResearchMethodType[] as unknown as Prisma.InputJsonValue }
        : {}),
      ...(parsed.goals !== undefined ? { goals: parsed.goals as Prisma.InputJsonValue } : {}),
      ...(parsed.researchQuestions !== undefined
        ? { researchQuestions: parsed.researchQuestions as Prisma.InputJsonValue }
        : {}),
      ...(parsed.hypotheses !== undefined
        ? { hypotheses: parsed.hypotheses as Prisma.InputJsonValue }
        : {}),
      ...(parsed.plan !== undefined ? { plan: parsed.plan as Prisma.InputJsonValue } : {}),
      ...(parsed.audience !== undefined ? { audience: parsed.audience as Prisma.InputJsonValue } : {}),
      ...(parsed.startsAt !== undefined ? { startsAt: parsed.startsAt } : {}),
      ...(parsed.endsAt !== undefined ? { endsAt: parsed.endsAt } : {}),
      ...(parsed.isFavorite !== undefined ? { isFavorite: parsed.isFavorite } : {}),
    };

    await prisma.$transaction(async (tx) => {
      await tx.researchProject.update({
        where: { id: researchProjectId },
        data,
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId,
          actorId,
          action: "updated",
          targetType: "research_project",
          targetId: researchProjectId,
          metadata: { fields: Object.keys(parsed) },
        },
      });
    });

    const detail = await getResearchProject(researchProjectId);
    if (!detail) {
      throw new ResourceNotFoundError("ResearchProject", researchProjectId);
    }
    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const linkSurveyToResearchProject = async (params: {
  researchProjectId: string;
  surveyId: string;
  organizationId: string;
  actorId: string;
}): Promise<void> => {
  validateInputs([params.researchProjectId, ZId], [params.surveyId, ZId], [params.organizationId, ZId]);

  const survey = await prisma.survey.findFirst({
    where: {
      id: params.surveyId,
      workspace: { organizationId: params.organizationId },
    },
    select: { id: true, name: true },
  });

  if (!survey) {
    throw new ResourceNotFoundError("Survey", params.surveyId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.researchProjectSurvey.upsert({
        where: {
          researchProjectId_surveyId: {
            researchProjectId: params.researchProjectId,
            surveyId: params.surveyId,
          },
        },
        create: {
          researchProjectId: params.researchProjectId,
          surveyId: params.surveyId,
          addedById: params.actorId,
        },
        update: {},
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: params.researchProjectId,
          actorId: params.actorId,
          action: "survey_linked",
          targetType: "survey",
          targetId: params.surveyId,
          metadata: { surveyName: survey.name },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const unlinkSurveyFromResearchProject = async (params: {
  researchProjectId: string;
  surveyId: string;
  actorId: string;
}): Promise<void> => {
  validateInputs([params.researchProjectId, ZId], [params.surveyId, ZId]);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.researchProjectSurvey.delete({
        where: {
          researchProjectId_surveyId: {
            researchProjectId: params.researchProjectId,
            surveyId: params.surveyId,
          },
        },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: params.researchProjectId,
          actorId: params.actorId,
          action: "survey_unlinked",
          targetType: "survey",
          targetId: params.surveyId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new ResourceNotFoundError("ResearchProjectSurvey", params.surveyId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const listOrganizationSurveysForLinking = reactCache(
  async (organizationId: string, search?: string) => {
    validateInputs([organizationId, ZId]);

    return prisma.survey.findMany({
      where: {
        workspace: { organizationId },
        ...(search?.trim()
          ? {
              name: { contains: search.trim(), mode: "insensitive" },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        workspaceId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }
);

export const listResearchClients = reactCache(async (organizationId: string) => {
  validateInputs([organizationId, ZId]);
  return prisma.researchClient.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
});

export const listResearchBrands = reactCache(async (organizationId: string, clientId?: string) => {
  validateInputs([organizationId, ZId]);
  return prisma.researchBrand.findMany({
    where: {
      organizationId,
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, clientId: true },
  });
});

export const getResearchProjectCounts = async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);

  const [responseCount, activityCount, interviewCount, insightCount] = await Promise.all([
    prisma.response.count({
      where: {
        survey: {
          researchProjectSurveys: {
            some: { researchProjectId },
          },
        },
      },
    }),
    prisma.researchActivity.count({ where: { researchProjectId } }),
    prisma.researchInterview.count({ where: { researchProjectId } }),
    prisma.researchInsight.count({ where: { researchProjectId } }),
  ]);

  return { responseCount, activityCount, interviewCount, insightCount };
};
