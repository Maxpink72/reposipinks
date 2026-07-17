import { JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { processResearchExportPdfJob } from "@/src/processors/research-export-pdf";
import { processResearchExportXlsxJob } from "@/src/processors/research-export-xlsx";
import { processResponsePipelineJob } from "@/src/processors/response-pipeline";
import { processSurveySchedulingJob } from "@/src/processors/survey-scheduling";
import { processTestLogJob } from "@/src/processors/test-log";
import {
  ZResearchExportPdfJobData,
  ZResearchExportXlsxJobData,
  ZResponsePipelineJobData,
  ZSurveySchedulingJobData,
  ZTestLogJobData,
} from "@/src/types";

export const backgroundJobDefinitions = {
  [JOB_NAMES.responsePipeline]: toAnyBackgroundJobDefinition({
    handle: processResponsePipelineJob,
    name: JOB_NAMES.responsePipeline,
    schema: ZResponsePipelineJobData,
  }),
  [JOB_NAMES.surveyScheduling]: toAnyBackgroundJobDefinition({
    handle: processSurveySchedulingJob,
    name: JOB_NAMES.surveyScheduling,
    schema: ZSurveySchedulingJobData,
  }),
  [JOB_NAMES.testLog]: toAnyBackgroundJobDefinition({
    handle: processTestLogJob,
    name: JOB_NAMES.testLog,
    schema: ZTestLogJobData,
  }),
  [JOB_NAMES.researchExportPdf]: toAnyBackgroundJobDefinition({
    handle: processResearchExportPdfJob,
    name: JOB_NAMES.researchExportPdf,
    schema: ZResearchExportPdfJobData,
  }),
  [JOB_NAMES.researchExportXlsx]: toAnyBackgroundJobDefinition({
    handle: processResearchExportXlsxJob,
    name: JOB_NAMES.researchExportXlsx,
    schema: ZResearchExportXlsxJobData,
  }),
} as const satisfies Record<string, AnyBackgroundJobDefinition>;

export type TBackgroundJobName = keyof typeof backgroundJobDefinitions;

export const getBackgroundJobDefinition = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  backgroundJobDefinitions[jobName as TBackgroundJobName];
