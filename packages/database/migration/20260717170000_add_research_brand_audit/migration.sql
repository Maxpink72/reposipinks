-- AlterEnum
ALTER TYPE "ResearchReportBlockType" ADD VALUE 'brand_audit';

-- CreateEnum
CREATE TYPE "ResearchBrandAuditStatus" AS ENUM ('draft', 'in_progress', 'completed', 'archived');

-- CreateTable
CREATE TABLE "ResearchBrandAudit" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "status" "ResearchBrandAuditStatus" NOT NULL DEFAULT 'draft',
    "templateKey" TEXT NOT NULL DEFAULT 'agency_default',
    "notes" TEXT,
    "swot" JSONB NOT NULL DEFAULT '{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]}',
    "positioningMatrix" JSONB NOT NULL DEFAULT '{}',
    "competitiveMatrix" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,

    CONSTRAINT "ResearchBrandAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBrandAuditCriterion" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "brandAuditId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxScore" INTEGER NOT NULL DEFAULT 5,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchBrandAuditCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBrandAuditAssessment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "brandAuditId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchBrandAuditAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchBrandAudit_researchProjectId_status_updated_at_idx" ON "ResearchBrandAudit"("researchProjectId", "status", "updated_at");
CREATE INDEX "ResearchBrandAudit_brandId_idx" ON "ResearchBrandAudit"("brandId");
CREATE INDEX "ResearchBrandAudit_createdById_idx" ON "ResearchBrandAudit"("createdById");

CREATE UNIQUE INDEX "ResearchBrandAuditCriterion_brandAuditId_key_key" ON "ResearchBrandAuditCriterion"("brandAuditId", "key");
CREATE INDEX "ResearchBrandAuditCriterion_brandAuditId_position_idx" ON "ResearchBrandAuditCriterion"("brandAuditId", "position");

CREATE UNIQUE INDEX "ResearchBrandAuditAssessment_brandAuditId_criterionId_key" ON "ResearchBrandAuditAssessment"("brandAuditId", "criterionId");
CREATE INDEX "ResearchBrandAuditAssessment_criterionId_idx" ON "ResearchBrandAuditAssessment"("criterionId");
CREATE INDEX "ResearchBrandAuditAssessment_assessedById_idx" ON "ResearchBrandAuditAssessment"("assessedById");

-- AddForeignKey
ALTER TABLE "ResearchBrandAudit" ADD CONSTRAINT "ResearchBrandAudit_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchBrandAudit" ADD CONSTRAINT "ResearchBrandAudit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "ResearchBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchBrandAudit" ADD CONSTRAINT "ResearchBrandAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchBrandAuditCriterion" ADD CONSTRAINT "ResearchBrandAuditCriterion_brandAuditId_fkey" FOREIGN KEY ("brandAuditId") REFERENCES "ResearchBrandAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchBrandAuditAssessment" ADD CONSTRAINT "ResearchBrandAuditAssessment_brandAuditId_fkey" FOREIGN KEY ("brandAuditId") REFERENCES "ResearchBrandAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchBrandAuditAssessment" ADD CONSTRAINT "ResearchBrandAuditAssessment_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ResearchBrandAuditCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchBrandAuditAssessment" ADD CONSTRAINT "ResearchBrandAuditAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
