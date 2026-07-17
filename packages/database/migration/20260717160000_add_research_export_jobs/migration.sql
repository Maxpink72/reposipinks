-- CreateEnum
CREATE TYPE "ResearchExportJobType" AS ENUM ('pdf', 'xlsx');

-- CreateEnum
CREATE TYPE "ResearchExportJobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "ResearchExportJob" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "reportVersionId" TEXT,
    "type" "ResearchExportJobType" NOT NULL DEFAULT 'pdf',
    "status" "ResearchExportJobStatus" NOT NULL DEFAULT 'queued',
    "options" JSONB NOT NULL DEFAULT '{}',
    "cacheKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "ResearchExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchExportArtifact" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportJobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT,
    "inlineData" BYTEA,
    "checksum" TEXT,

    CONSTRAINT "ResearchExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchExportJob_researchProjectId_created_at_idx" ON "ResearchExportJob"("researchProjectId", "created_at");
CREATE INDEX "ResearchExportJob_reportId_status_created_at_idx" ON "ResearchExportJob"("reportId", "status", "created_at");
CREATE INDEX "ResearchExportJob_status_created_at_idx" ON "ResearchExportJob"("status", "created_at");
CREATE INDEX "ResearchExportJob_cacheKey_idx" ON "ResearchExportJob"("cacheKey");
CREATE INDEX "ResearchExportJob_createdById_idx" ON "ResearchExportJob"("createdById");

CREATE UNIQUE INDEX "ResearchExportArtifact_exportJobId_key" ON "ResearchExportArtifact"("exportJobId");
CREATE INDEX "ResearchExportArtifact_storageKey_idx" ON "ResearchExportArtifact"("storageKey");

-- AddForeignKey
ALTER TABLE "ResearchExportJob" ADD CONSTRAINT "ResearchExportJob_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchExportJob" ADD CONSTRAINT "ResearchExportJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ResearchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchExportJob" ADD CONSTRAINT "ResearchExportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchExportArtifact" ADD CONSTRAINT "ResearchExportArtifact_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "ResearchExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
