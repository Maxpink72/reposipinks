import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  DEFAULT_REPORT_THEME_TOKENS,
  type TResearchReportBlockContent,
  type TResearchReportBlockInput,
  type TResearchReportExportOptions,
  type TResearchReportStatus,
  type TResearchReportThemeTokens,
  REPORT_STATUS_TRANSITIONS,
  ZResearchReportBlockContent,
  ZResearchReportExportOptions,
  ZResearchReportThemeTokens,
} from "@/modules/research/types/report";

const reportListInclude = {
  theme: { select: { id: true, name: true, tokens: true, isDefault: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { blocks: true, versions: true } },
} satisfies Prisma.ResearchReportInclude;

const reportDetailInclude = {
  theme: true,
  createdBy: { select: { id: true, name: true, email: true } },
  blocks: { orderBy: { position: "asc" as const } },
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 20,
    include: { createdBy: { select: { id: true, name: true } } },
  },
  researchProject: { select: { id: true, organizationId: true, name: true } },
} satisfies Prisma.ResearchReportInclude;

export type TResearchReportListItem = Prisma.ResearchReportGetPayload<{
  include: typeof reportListInclude;
}>;

export type TResearchReportDetail = Prisma.ResearchReportGetPayload<{
  include: typeof reportDetailInclude;
}>;

const STATUS_TRANSITIONS = REPORT_STATUS_TRANSITIONS;

const assertEmbedsBelongToProject = async (
  researchProjectId: string,
  blocks: TResearchReportBlockInput[]
) => {
  const analysisIds = blocks
    .map((b) => (b.content.kind === "analysis" ? b.content.analysisBlockId : null))
    .filter((id): id is string => Boolean(id) && id !== "_");
  const insightIds = blocks
    .map((b) => (b.content.kind === "insight" ? b.content.insightId : null))
    .filter((id): id is string => Boolean(id) && id !== "_");

  if (blocks.some((b) => b.content.kind === "analysis" && b.content.analysisBlockId === "_")) {
    throw new InvalidInputError("Select an analysis block before saving");
  }
  if (blocks.some((b) => b.content.kind === "insight" && b.content.insightId === "_")) {
    throw new InvalidInputError("Select an insight before saving");
  }
  if (blocks.some((b) => b.content.kind === "brand_audit" && b.content.brandAuditId === "_")) {
    throw new InvalidInputError("Select a brand audit before saving");
  }

  const brandAuditIds = blocks
    .map((b) => (b.content.kind === "brand_audit" ? b.content.brandAuditId : null))
    .filter((id): id is string => Boolean(id) && id !== "_");

  if (analysisIds.length > 0) {
    const found = await prisma.researchAnalysisBlock.count({
      where: { researchProjectId, id: { in: analysisIds } },
    });
    if (found !== new Set(analysisIds).size) {
      throw new InvalidInputError("Analysis block embed must belong to this project");
    }
  }
  if (insightIds.length > 0) {
    const found = await prisma.researchInsight.count({
      where: { researchProjectId, id: { in: insightIds } },
    });
    if (found !== new Set(insightIds).size) {
      throw new InvalidInputError("Insight embed must belong to this project");
    }
  }
  if (brandAuditIds.length > 0) {
    const found = await prisma.researchBrandAudit.count({
      where: { researchProjectId, id: { in: brandAuditIds } },
    });
    if (found !== new Set(brandAuditIds).size) {
      throw new InvalidInputError("Brand audit embed must belong to this project");
    }
  }
};

export const listResearchReports = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);
  return prisma.researchReport.findMany({
    where: { researchProjectId, archivedAt: null },
    include: reportListInclude,
    orderBy: { updatedAt: "desc" },
  });
});

export const getResearchReport = reactCache(async (reportId: string) => {
  validateInputs([reportId, ZId]);
  return prisma.researchReport.findUnique({
    where: { id: reportId },
    include: reportDetailInclude,
  });
});

export const listResearchReportThemes = reactCache(async (organizationId: string) => {
  validateInputs([organizationId, ZId]);
  return prisma.researchReportTheme.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
});

export const ensureDefaultReportTheme = async (organizationId: string) => {
  const existing = await prisma.researchReportTheme.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (existing) return existing;

  try {
    return await prisma.researchReportTheme.create({
      data: {
        organizationId,
        name: "Agency Default",
        isDefault: true,
        tokens: DEFAULT_REPORT_THEME_TOKENS as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.researchReportTheme.findFirstOrThrow({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
      });
    }
    throw error;
  }
};

export const createResearchReport = async (params: {
  researchProjectId: string;
  title: string;
  subtitle?: string;
  themeId?: string;
  actorId: string;
}): Promise<TResearchReportDetail> => {
  const project = await prisma.researchProject.findUnique({
    where: { id: params.researchProjectId },
    select: { id: true, organizationId: true },
  });
  if (!project) throw new ResourceNotFoundError("ResearchProject", params.researchProjectId);

  let themeId = params.themeId ?? null;
  if (!themeId) {
    const theme = await ensureDefaultReportTheme(project.organizationId);
    themeId = theme.id;
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const report = await tx.researchReport.create({
        data: {
          researchProjectId: params.researchProjectId,
          title: params.title.trim(),
          subtitle: params.subtitle?.trim() || null,
          themeId,
          createdById: params.actorId,
          exportOptions: {
            pageSize: "A4",
            orientation: "portrait",
            includeToc: false,
          } satisfies TResearchReportExportOptions as unknown as Prisma.InputJsonValue,
          blocks: {
            create: [
              {
                type: "heading",
                position: 0,
                content: { kind: "heading", text: params.title.trim(), level: 1 } as unknown as Prisma.InputJsonValue,
              },
              {
                type: "paragraph",
                position: 1,
                content: {
                  kind: "paragraph",
                  text: params.subtitle?.trim() || "",
                } as unknown as Prisma.InputJsonValue,
              },
            ],
          },
        },
        include: reportDetailInclude,
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: params.researchProjectId,
          actorId: params.actorId,
          action: "report_created",
          targetType: "report",
          targetId: report.id,
          metadata: { title: report.title },
        },
      });

      return report;
    });

    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateResearchReportMeta = async (params: {
  reportId: string;
  title?: string;
  subtitle?: string | null;
  themeId?: string | null;
  exportOptions?: TResearchReportExportOptions;
  actorId: string;
}): Promise<TResearchReportDetail> => {
  const existing = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    select: { id: true, researchProjectId: true, status: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchReport", params.reportId);
  if (existing.status === "archived") {
    throw new InvalidInputError("Cannot edit an archived report");
  }

  const data: Prisma.ResearchReportUpdateInput = {};
  if (params.title !== undefined) data.title = params.title.trim();
  if (params.subtitle !== undefined) data.subtitle = params.subtitle;
  if (params.themeId !== undefined) {
    data.theme = params.themeId ? { connect: { id: params.themeId } } : { disconnect: true };
  }
  if (params.exportOptions !== undefined) {
    data.exportOptions = ZResearchReportExportOptions.parse(
      params.exportOptions
    ) as unknown as Prisma.InputJsonValue;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const report = await tx.researchReport.update({
      where: { id: params.reportId },
      data,
      include: reportDetailInclude,
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId: params.actorId,
        action: "report_updated",
        targetType: "report",
        targetId: report.id,
      },
    });
    return report;
  });

  return updated;
};

export const saveResearchReportBlocks = async (params: {
  reportId: string;
  blocks: TResearchReportBlockInput[];
  actorId: string;
}): Promise<TResearchReportDetail> => {
  const existing = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    select: { id: true, researchProjectId: true, status: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchReport", params.reportId);
  if (existing.status === "archived" || existing.status === "published") {
    throw new InvalidInputError("Cannot edit blocks of a published or archived report — create a new version from draft");
  }

  const parsedBlocks = params.blocks.map((block, index) => {
    const content = ZResearchReportBlockContent.parse(block.content);
    if (content.kind !== block.type) {
      throw new InvalidInputError(
        `Block ${index}: type "${block.type}" does not match content kind "${content.kind}"`
      );
    }
    return {
      id: block.id || createId(),
      type: block.type,
      content,
      position: index,
    };
  });

  await assertEmbedsBelongToProject(existing.researchProjectId, parsedBlocks);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.researchReportBlock.deleteMany({ where: { reportId: params.reportId } });
      if (parsedBlocks.length > 0) {
        await tx.researchReportBlock.createMany({
          data: parsedBlocks.map((b) => ({
            id: b.id,
            reportId: params.reportId,
            type: b.type,
            position: b.position,
            content: b.content as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      await tx.researchReport.update({
        where: { id: params.reportId },
        data: { updatedAt: new Date() },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: existing.researchProjectId,
          actorId: params.actorId,
          action: "report_blocks_saved",
          targetType: "report",
          targetId: params.reportId,
          metadata: { blockCount: parsedBlocks.length },
        },
      });
      return tx.researchReport.findUniqueOrThrow({
        where: { id: params.reportId },
        include: reportDetailInclude,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateResearchReportStatus = async (params: {
  reportId: string;
  status: TResearchReportStatus;
  actorId: string;
}): Promise<TResearchReportDetail> => {
  const existing = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    select: { id: true, researchProjectId: true, status: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchReport", params.reportId);

  const current = existing.status as TResearchReportStatus;
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(params.status)) {
    throw new InvalidInputError(`Cannot transition report from ${current} to ${params.status}`);
  }

  const data: Prisma.ResearchReportUpdateInput = {
    status: params.status,
  };
  if (params.status === "published") {
    data.publishedAt = new Date();
    data.archivedAt = null;
  }
  if (params.status === "archived") {
    data.archivedAt = new Date();
  }
  if (params.status === "draft" && current === "archived") {
    data.archivedAt = null;
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.researchReport.update({
      where: { id: params.reportId },
      data,
      include: reportDetailInclude,
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId: params.actorId,
        action: "report_status_changed",
        targetType: "report",
        targetId: report.id,
        metadata: { from: current, to: params.status },
      },
    });
    return report;
  });
};

export const createResearchReportVersion = async (params: {
  reportId: string;
  label?: string;
  note?: string;
  actorId: string;
}) => {
  const report = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      theme: true,
    },
  });
  if (!report) throw new ResourceNotFoundError("ResearchReport", params.reportId);

  const last = await prisma.researchReportVersion.findFirst({
    where: { reportId: params.reportId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  const themeTokens = report.theme
    ? ZResearchReportThemeTokens.parse({
        ...DEFAULT_REPORT_THEME_TOKENS,
        ...(report.theme.tokens as object),
      })
    : DEFAULT_REPORT_THEME_TOKENS;

  const snapshot = {
    title: report.title,
    subtitle: report.subtitle,
    status: report.status,
    themeId: report.themeId,
    themeTokens,
    exportOptions: report.exportOptions,
    blocks: report.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      position: b.position,
      content: b.content,
    })),
  };

  return prisma.$transaction(async (tx) => {
    const version = await tx.researchReportVersion.create({
      data: {
        reportId: params.reportId,
        versionNumber,
        label: params.label ?? `v${versionNumber}`,
        note: params.note ?? null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        createdById: params.actorId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    await tx.researchActivity.create({
      data: {
        researchProjectId: report.researchProjectId,
        actorId: params.actorId,
        action: "report_version_created",
        targetType: "report_version",
        targetId: version.id,
        metadata: { reportId: report.id, versionNumber },
      },
    });
    return version;
  });
};

export const upsertResearchReportTheme = async (params: {
  organizationId: string;
  themeId?: string;
  name: string;
  isDefault?: boolean;
  tokens?: Partial<TResearchReportThemeTokens>;
}) => {
  const tokens = ZResearchReportThemeTokens.parse({
    ...DEFAULT_REPORT_THEME_TOKENS,
    ...params.tokens,
  });

  return prisma.$transaction(async (tx) => {
    if (params.isDefault) {
      await tx.researchReportTheme.updateMany({
        where: { organizationId: params.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (params.themeId) {
      return tx.researchReportTheme.update({
        where: { id: params.themeId },
        data: {
          name: params.name.trim(),
          isDefault: params.isDefault ?? undefined,
          tokens: tokens as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return tx.researchReportTheme.create({
      data: {
        organizationId: params.organizationId,
        name: params.name.trim(),
        isDefault: params.isDefault ?? false,
        tokens: tokens as unknown as Prisma.InputJsonValue,
      },
    });
  });
};

export const deleteResearchReport = async (reportId: string, actorId: string) => {
  const existing = await prisma.researchReport.findUnique({
    where: { id: reportId },
    select: { id: true, researchProjectId: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchReport", reportId);

  await prisma.$transaction(async (tx) => {
    await tx.researchReport.delete({ where: { id: reportId } });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "report_deleted",
        targetType: "report",
        targetId: reportId,
      },
    });
  });
};

export const parseBlockContent = (raw: unknown): TResearchReportBlockContent =>
  ZResearchReportBlockContent.parse(raw);
