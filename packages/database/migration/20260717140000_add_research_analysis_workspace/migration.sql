-- CreateEnum
CREATE TYPE "ResearchDatasetSourceType" AS ENUM ('csv', 'xlsx', 'manual');

-- CreateTable
CREATE TABLE "ResearchDataset" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "ResearchDatasetSourceType" NOT NULL DEFAULT 'csv',
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,

    CONSTRAINT "ResearchDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchAnalysisBlock" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "analystComment" TEXT,
    "chartDefinition" JSONB NOT NULL,
    "lastResult" JSONB,
    "datasetId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "ResearchAnalysisBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchDataset_researchProjectId_updated_at_idx" ON "ResearchDataset"("researchProjectId", "updated_at");
CREATE INDEX "ResearchDataset_createdById_idx" ON "ResearchDataset"("createdById");
CREATE UNIQUE INDEX "ResearchDataset_researchProjectId_name_key" ON "ResearchDataset"("researchProjectId", "name");

CREATE INDEX "ResearchAnalysisBlock_researchProjectId_updated_at_idx" ON "ResearchAnalysisBlock"("researchProjectId", "updated_at");
CREATE INDEX "ResearchAnalysisBlock_datasetId_idx" ON "ResearchAnalysisBlock"("datasetId");
CREATE INDEX "ResearchAnalysisBlock_createdById_idx" ON "ResearchAnalysisBlock"("createdById");

-- AddForeignKey
ALTER TABLE "ResearchDataset" ADD CONSTRAINT "ResearchDataset_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDataset" ADD CONSTRAINT "ResearchDataset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchAnalysisBlock" ADD CONSTRAINT "ResearchAnalysisBlock_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysisBlock" ADD CONSTRAINT "ResearchAnalysisBlock_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ResearchDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysisBlock" ADD CONSTRAINT "ResearchAnalysisBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
