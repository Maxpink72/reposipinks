-- CreateEnum
CREATE TYPE "ResearchReportStatus" AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ResearchReportBlockType" AS ENUM ('heading', 'paragraph', 'bullets', 'analysis', 'insight', 'quote', 'page_break', 'divider');

-- CreateTable
CREATE TABLE "ResearchReportTheme" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "tokens" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ResearchReportTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReport" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "status" "ResearchReportStatus" NOT NULL DEFAULT 'draft',
    "themeId" TEXT,
    "exportOptions" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReportBlock" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" "ResearchReportBlockType" NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ResearchReportBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReportVersion" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ResearchReportVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchReportTheme_organizationId_name_key" ON "ResearchReportTheme"("organizationId", "name");
CREATE INDEX "ResearchReportTheme_organizationId_isDefault_idx" ON "ResearchReportTheme"("organizationId", "isDefault");

CREATE INDEX "ResearchReport_researchProjectId_status_updated_at_idx" ON "ResearchReport"("researchProjectId", "status", "updated_at");
CREATE INDEX "ResearchReport_themeId_idx" ON "ResearchReport"("themeId");
CREATE INDEX "ResearchReport_createdById_idx" ON "ResearchReport"("createdById");

CREATE UNIQUE INDEX "ResearchReportBlock_reportId_position_key" ON "ResearchReportBlock"("reportId", "position");
CREATE INDEX "ResearchReportBlock_reportId_position_idx" ON "ResearchReportBlock"("reportId", "position");

CREATE UNIQUE INDEX "ResearchReportVersion_reportId_versionNumber_key" ON "ResearchReportVersion"("reportId", "versionNumber");
CREATE INDEX "ResearchReportVersion_reportId_created_at_idx" ON "ResearchReportVersion"("reportId", "created_at");
CREATE INDEX "ResearchReportVersion_createdById_idx" ON "ResearchReportVersion"("createdById");

-- AddForeignKey
ALTER TABLE "ResearchReportTheme" ADD CONSTRAINT "ResearchReportTheme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ResearchReportTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchReportBlock" ADD CONSTRAINT "ResearchReportBlock_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ResearchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchReportVersion" ADD CONSTRAINT "ResearchReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ResearchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchReportVersion" ADD CONSTRAINT "ResearchReportVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
