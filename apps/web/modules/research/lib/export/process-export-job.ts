import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { putObject } from "@formbricks/storage";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  buildExportCacheKey,
  sha256Hex,
} from "@/modules/research/lib/export/cache-key";
import { renderHtmlToPdfBuffer } from "@/modules/research/lib/export/pdf";
import {
  renderResearchReportPrintHtml,
  type TPrintEmbedAnalysis,
  type TPrintEmbedInsight,
} from "@/modules/research/lib/export/print-html";
import {
  DEFAULT_REPORT_THEME_TOKENS,
  type TResearchReportBlockContent,
  type TResearchReportExportOptions,
  ZResearchReportExportOptions,
  ZResearchReportThemeTokens,
} from "@/modules/research/types/report";

const MAX_INLINE_BYTES = 8 * 1024 * 1024; // 8MB fallback when S3 unavailable

type SnapshotBlock = {
  id: string;
  type: string;
  position: number;
  content: TResearchReportBlockContent;
};

const loadEmbeds = async (researchProjectId: string, blocks: SnapshotBlock[]) => {
  const analysisIds = blocks
    .map((b) => (b.content.kind === "analysis" ? b.content.analysisBlockId : null))
    .filter((id): id is string => Boolean(id) && id !== "_");
  const insightIds = blocks
    .map((b) => (b.content.kind === "insight" ? b.content.insightId : null))
    .filter((id): id is string => Boolean(id) && id !== "_");

  const [analysisBlocks, insights] = await Promise.all([
    analysisIds.length
      ? prisma.researchAnalysisBlock.findMany({
          where: { researchProjectId, id: { in: analysisIds } },
          select: { id: true, title: true, lastResult: true },
        })
      : Promise.resolve([]),
    insightIds.length
      ? prisma.researchInsight.findMany({
          where: { researchProjectId, id: { in: insightIds } },
          select: { id: true, title: true, description: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  const analysisById: Record<string, TPrintEmbedAnalysis> = {};
  for (const a of analysisBlocks) {
    analysisById[a.id] = {
      id: a.id,
      title: a.title,
      lastResult: a.lastResult as TPrintEmbedAnalysis["lastResult"],
    };
  }
  const insightById: Record<string, TPrintEmbedInsight> = {};
  for (const i of insights) {
    insightById[i.id] = {
      id: i.id,
      title: i.title,
      description: i.description,
      type: i.type,
    };
  }
  return { analysisById, insightById };
};

export const processResearchExportPdfJob = async (exportJobId: string): Promise<void> => {
  const job = await prisma.researchExportJob.findUnique({
    where: { id: exportJobId },
    include: {
      report: {
        include: {
          blocks: { orderBy: { position: "asc" } },
          theme: true,
          researchProject: { select: { id: true, name: true, organizationId: true, workspaceId: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!job) {
    throw new ResourceNotFoundError("ResearchExportJob", exportJobId);
  }
  if (job.type !== "pdf") {
    throw new InvalidInputError("processResearchExportPdfJob expects type=pdf");
  }
  if (job.status === "cancelled") {
    return;
  }

  const startedAt = new Date();
  await prisma.researchExportJob.update({
    where: { id: exportJobId },
    data: {
      status: "processing",
      startedAt,
      attempts: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    let title = job.report.title;
    let subtitle = job.report.subtitle;
    let blocks: SnapshotBlock[] = job.report.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      position: b.position,
      content: b.content as TResearchReportBlockContent,
    }));
    let tokens = job.report.theme
      ? ZResearchReportThemeTokens.parse({
          ...DEFAULT_REPORT_THEME_TOKENS,
          ...(job.report.theme.tokens as object),
        })
      : DEFAULT_REPORT_THEME_TOKENS;
    let exportOptions = ZResearchReportExportOptions.parse(
      (job.options as object) || job.report.exportOptions || {}
    );

    if (job.reportVersionId) {
      const version = await prisma.researchReportVersion.findUnique({
        where: { id: job.reportVersionId },
      });
      if (version) {
        const snapshot = version.snapshot as {
          title?: string;
          subtitle?: string | null;
          themeTokens?: object;
          exportOptions?: object;
          blocks?: SnapshotBlock[];
        };
        title = snapshot.title ?? title;
        subtitle = snapshot.subtitle ?? subtitle;
        if (snapshot.themeTokens) {
          tokens = ZResearchReportThemeTokens.parse({
            ...DEFAULT_REPORT_THEME_TOKENS,
            ...snapshot.themeTokens,
          });
        }
        if (snapshot.exportOptions) {
          exportOptions = ZResearchReportExportOptions.parse(snapshot.exportOptions);
        }
        if (Array.isArray(snapshot.blocks)) {
          blocks = snapshot.blocks;
        }
      }
    }

    const { analysisById, insightById } = await loadEmbeds(job.researchProjectId, blocks);
    const generatedAt = new Date().toISOString();
    const html = renderResearchReportPrintHtml({
      title,
      subtitle,
      projectName: job.report.researchProject.name,
      generatedAt,
      tokens,
      exportOptions,
      blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content })),
      analysisById,
      insightById,
      includeToc: exportOptions.includeToc,
    });

    const pdfBuffer = await renderHtmlToPdfBuffer(html, {
      orientation: exportOptions.orientation,
      format: "A4",
    });

    const checksum = sha256Hex(pdfBuffer);
    const safeTitle = title.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim().slice(0, 80) || "report";
    const fileName = `${safeTitle}-${checksum.slice(0, 8)}.pdf`;
    const orgId = job.report.researchProject.organizationId;
    const workspaceId = job.report.researchProject.workspaceId ?? orgId;
    const storageKey = `${workspaceId}/private/research/exports/${job.researchProjectId}/${fileName}`;

    let storedKey: string | null = null;
    let inlineData: Buffer | null = null;

    const upload = await putObject({
      fileKey: storageKey,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    if (upload.ok) {
      storedKey = upload.data.fileKey;
    } else if (pdfBuffer.byteLength <= MAX_INLINE_BYTES) {
      logger.warn(
        { exportJobId, code: upload.error.code },
        "S3 upload failed for research PDF; storing inline artifact"
      );
      inlineData = pdfBuffer;
    } else {
      throw new Error(`storage_unavailable:${upload.error.code}`);
    }

    const finishedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.researchExportArtifact.deleteMany({ where: { exportJobId } });
      await tx.researchExportArtifact.create({
        data: {
          id: createId(),
          exportJobId,
          fileName,
          contentType: "application/pdf",
          byteSize: pdfBuffer.byteLength,
          storageKey: storedKey,
          inlineData: inlineData ?? undefined,
          checksum,
        },
      });
      await tx.researchExportJob.update({
        where: { id: exportJobId },
        data: {
          status: "completed",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: null,
          errorMessage: null,
        },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: job.researchProjectId,
          actorId: job.createdById,
          action: "export_pdf_completed",
          targetType: "export_job",
          targetId: exportJobId,
          metadata: { reportId: job.reportId, byteSize: pdfBuffer.byteLength, storageKey: storedKey },
        },
      });
    });
  } catch (error) {
    const finishedAt = new Date();
    const isChromium =
      error instanceof Error &&
      (error.name === "ChromiumUnavailableError" || error.message === "chromium_unavailable");
    const errorCode = isChromium
      ? "chromium_unavailable"
      : error instanceof Error && error.message.startsWith("storage_unavailable")
        ? "storage_unavailable"
        : "export_failed";
    const errorMessage = isChromium
      ? "Playwright Chromium is not available. Run: pnpm exec playwright install chromium"
      : error instanceof Error
        ? error.message.slice(0, 500)
        : "Unknown export error";

    logger.error({ err: error, exportJobId, errorCode }, "Research PDF export failed");

    await prisma.researchExportJob.update({
      where: { id: exportJobId },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorCode,
        errorMessage,
      },
    });
  }
};

export const createResearchPdfExportJob = async (params: {
  reportId: string;
  reportVersionId?: string;
  actorId: string;
  options?: Partial<TResearchReportExportOptions>;
  processInline?: boolean;
}) => {
  const report = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      versions: params.reportVersionId
        ? { where: { id: params.reportVersionId }, take: 1 }
        : { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!report) throw new ResourceNotFoundError("ResearchReport", params.reportId);

  const exportOptions = ZResearchReportExportOptions.parse({
    ...(report.exportOptions as object),
    ...params.options,
  });
  const snapshotSource = params.reportVersionId
    ? report.versions[0]?.snapshot
    : {
        blocks: report.blocks,
        title: report.title,
        exportOptions,
      };
  const snapshotHash = sha256Hex(JSON.stringify(snapshotSource ?? {}));
  const optionsHash = sha256Hex(JSON.stringify(exportOptions));
  const cacheKey = buildExportCacheKey({
    reportId: report.id,
    reportVersionId: params.reportVersionId ?? report.versions[0]?.id,
    snapshotHash,
    optionsHash,
  });

  const cached = await prisma.researchExportJob.findFirst({
    where: {
      reportId: report.id,
      type: "pdf",
      status: "completed",
      cacheKey,
      artifact: { isNot: null },
    },
    include: { artifact: true },
    orderBy: { finishedAt: "desc" },
  });
  if (cached) {
    return cached;
  }

  const created = await prisma.researchExportJob.create({
    data: {
      researchProjectId: report.researchProjectId,
      reportId: report.id,
      reportVersionId: params.reportVersionId ?? report.versions[0]?.id ?? null,
      type: "pdf",
      status: "queued",
      options: exportOptions as unknown as Prisma.InputJsonValue,
      cacheKey,
      createdById: params.actorId,
    },
    include: { artifact: true },
  });

  await prisma.researchActivity.create({
    data: {
      researchProjectId: report.researchProjectId,
      actorId: params.actorId,
      action: "export_pdf_queued",
      targetType: "export_job",
      targetId: created.id,
      metadata: { reportId: report.id },
    },
  });

  if (params.processInline) {
    await processResearchExportPdfJob(created.id);
    return prisma.researchExportJob.findUniqueOrThrow({
      where: { id: created.id },
      include: { artifact: true },
    });
  }

  return created;
};

export const processResearchExportXlsxJob = async (exportJobId: string): Promise<void> => {
  const job = await prisma.researchExportJob.findUnique({
    where: { id: exportJobId },
    include: {
      report: {
        include: {
          blocks: { orderBy: { position: "asc" } },
          researchProject: { select: { id: true, name: true, organizationId: true, workspaceId: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
      createdBy: { select: { email: true } },
    },
  });

  if (!job) {
    throw new ResourceNotFoundError("ResearchExportJob", exportJobId);
  }
  if (job.type !== "xlsx") {
    throw new InvalidInputError("processResearchExportXlsxJob expects type=xlsx");
  }
  if (job.status === "cancelled") {
    return;
  }

  const startedAt = new Date();
  await prisma.researchExportJob.update({
    where: { id: exportJobId },
    data: {
      status: "processing",
      startedAt,
      attempts: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    let title = job.report.title;
    let subtitle = job.report.subtitle;
    let blocks: SnapshotBlock[] = job.report.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      position: b.position,
      content: b.content as TResearchReportBlockContent,
    }));

    if (job.reportVersionId) {
      const version = await prisma.researchReportVersion.findUnique({
        where: { id: job.reportVersionId },
      });
      if (version) {
        const snapshot = version.snapshot as {
          title?: string;
          subtitle?: string | null;
          blocks?: SnapshotBlock[];
        };
        title = snapshot.title ?? title;
        subtitle = snapshot.subtitle ?? subtitle;
        if (Array.isArray(snapshot.blocks)) {
          blocks = snapshot.blocks;
        }
      }
    }

    const { buildResearchReportXlsxBuffer } = await import("@/modules/research/lib/export/build-xlsx");
    const xlsxBuffer = await buildResearchReportXlsxBuffer({
      researchProjectId: job.researchProjectId,
      reportId: job.reportId,
      title,
      subtitle,
      blocks,
      reportVersionId: job.reportVersionId,
      actorEmail: job.createdBy?.email,
    });

    const checksum = sha256Hex(xlsxBuffer);
    const safeTitle = title.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim().slice(0, 80) || "report";
    const fileName = `${safeTitle}-${checksum.slice(0, 8)}.xlsx`;
    const orgId = job.report.researchProject.organizationId;
    const workspaceId = job.report.researchProject.workspaceId ?? orgId;
    const storageKey = `${workspaceId}/private/research/exports/${job.researchProjectId}/${fileName}`;

    let storedKey: string | null = null;
    let inlineData: Buffer | null = null;

    const upload = await putObject({
      fileKey: storageKey,
      body: xlsxBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    if (upload.ok) {
      storedKey = upload.data.fileKey;
    } else if (xlsxBuffer.byteLength <= MAX_INLINE_BYTES) {
      logger.warn(
        { exportJobId, code: upload.error.code },
        "S3 upload failed for research XLSX; storing inline artifact"
      );
      inlineData = xlsxBuffer;
    } else {
      throw new Error(`storage_unavailable:${upload.error.code}`);
    }

    const finishedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.researchExportArtifact.deleteMany({ where: { exportJobId } });
      await tx.researchExportArtifact.create({
        data: {
          id: createId(),
          exportJobId,
          fileName,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          byteSize: xlsxBuffer.byteLength,
          storageKey: storedKey,
          inlineData: inlineData ?? undefined,
          checksum,
        },
      });
      await tx.researchExportJob.update({
        where: { id: exportJobId },
        data: {
          status: "completed",
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: null,
          errorMessage: null,
        },
      });
      await tx.researchActivity.create({
        data: {
          researchProjectId: job.researchProjectId,
          actorId: job.createdById,
          action: "export_xlsx_completed",
          targetType: "export_job",
          targetId: exportJobId,
          metadata: { reportId: job.reportId, byteSize: xlsxBuffer.byteLength, storageKey: storedKey },
        },
      });
    });
  } catch (error) {
    const finishedAt = new Date();
    const errorCode =
      error instanceof Error && error.message.startsWith("storage_unavailable")
        ? "storage_unavailable"
        : "export_failed";
    const errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Unknown export error";

    logger.error({ err: error, exportJobId, errorCode }, "Research XLSX export failed");

    await prisma.researchExportJob.update({
      where: { id: exportJobId },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorCode,
        errorMessage,
      },
    });
  }
};

export const createResearchXlsxExportJob = async (params: {
  reportId: string;
  reportVersionId?: string;
  actorId: string;
  processInline?: boolean;
}) => {
  const report = await prisma.researchReport.findUnique({
    where: { id: params.reportId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      versions: params.reportVersionId
        ? { where: { id: params.reportVersionId }, take: 1 }
        : { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!report) throw new ResourceNotFoundError("ResearchReport", params.reportId);

  const snapshotSource = params.reportVersionId
    ? report.versions[0]?.snapshot
    : { blocks: report.blocks, title: report.title };
  const snapshotHash = sha256Hex(JSON.stringify(snapshotSource ?? {}));
  const optionsHash = sha256Hex("xlsx:v1");
  const cacheKey = buildExportCacheKey({
    reportId: report.id,
    reportVersionId: params.reportVersionId ?? report.versions[0]?.id,
    snapshotHash,
    optionsHash,
  });

  const cached = await prisma.researchExportJob.findFirst({
    where: {
      reportId: report.id,
      type: "xlsx",
      status: "completed",
      cacheKey,
      artifact: { isNot: null },
    },
    include: { artifact: true },
    orderBy: { finishedAt: "desc" },
  });
  if (cached) {
    return cached;
  }

  const created = await prisma.researchExportJob.create({
    data: {
      researchProjectId: report.researchProjectId,
      reportId: report.id,
      reportVersionId: params.reportVersionId ?? report.versions[0]?.id ?? null,
      type: "xlsx",
      status: "queued",
      options: { format: "xlsx" } as unknown as Prisma.InputJsonValue,
      cacheKey,
      createdById: params.actorId,
    },
    include: { artifact: true },
  });

  await prisma.researchActivity.create({
    data: {
      researchProjectId: report.researchProjectId,
      actorId: params.actorId,
      action: "export_xlsx_queued",
      targetType: "export_job",
      targetId: created.id,
      metadata: { reportId: report.id },
    },
  });

  if (params.processInline) {
    await processResearchExportXlsxJob(created.id);
    return prisma.researchExportJob.findUniqueOrThrow({
      where: { id: created.id },
      include: { artifact: true },
    });
  }

  return created;
};
