import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResearchExportPdfJobData } from "@/src/types";

export const processResearchExportPdfJob: JobHandler<TResearchExportPdfJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      exportJobId: data.exportJobId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ research export PDF processor override is not registered"
  );

  throw new Error(
    `BullMQ research export PDF processor override missing for job ${context.jobId} (${data.exportJobId})`
  );
};
