import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResearchExportXlsxJobData } from "@/src/types";

export const processResearchExportXlsxJob: JobHandler<TResearchExportXlsxJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      exportJobId: data.exportJobId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ research export XLSX processor override is not registered"
  );

  throw new Error(
    `BullMQ research export XLSX processor override missing for job ${context.jobId} (${data.exportJobId})`
  );
};
