import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { getSignedDownloadUrl } from "@formbricks/storage";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getResearchExportJob = reactCache(async (exportJobId: string) => {
  validateInputs([exportJobId, ZId]);
  return prisma.researchExportJob.findUnique({
    where: { id: exportJobId },
    include: {
      artifact: {
        select: {
          id: true,
          fileName: true,
          contentType: true,
          byteSize: true,
          storageKey: true,
          checksum: true,
          createdAt: true,
        },
      },
    },
  });
});

export const listResearchExportJobsForReport = reactCache(
  async (reportId: string, type?: "pdf" | "xlsx", limit = 10) => {
    validateInputs([reportId, ZId]);
    return prisma.researchExportJob.findMany({
      where: { reportId, ...(type ? { type } : {}) },
      include: {
        artifact: {
          select: {
            id: true,
            fileName: true,
            contentType: true,
            byteSize: true,
            checksum: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
);

export const getResearchExportDownload = async (
  exportJobId: string
): Promise<
  | { kind: "url"; url: string; fileName: string; contentType: string }
  | { kind: "base64"; base64: string; fileName: string; contentType: string }
> => {
  const job = await prisma.researchExportJob.findUnique({
    where: { id: exportJobId },
    include: { artifact: true },
  });
  if (!job) throw new ResourceNotFoundError("ResearchExportJob", exportJobId);
  if (job.status !== "completed" || !job.artifact) {
    throw new ResourceNotFoundError("ResearchExportArtifact", exportJobId);
  }

  const { artifact } = job;
  if (artifact.storageKey) {
    const signed = await getSignedDownloadUrl(artifact.storageKey);
    if (signed.ok) {
      return {
        kind: "url",
        url: signed.data,
        fileName: artifact.fileName,
        contentType: artifact.contentType,
      };
    }
  }

  if (artifact.inlineData) {
    return {
      kind: "base64",
      base64: Buffer.from(artifact.inlineData).toString("base64"),
      fileName: artifact.fileName,
      contentType: artifact.contentType,
    };
  }

  throw new ResourceNotFoundError("ResearchExportArtifact", artifact.id);
};
