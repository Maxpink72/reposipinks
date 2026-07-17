-- CreateEnum
CREATE TYPE "ResearchProjectStatus" AS ENUM ('draft', 'planning', 'recruiting', 'fieldwork', 'analysis', 'reporting', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ResearchMemberRole" AS ENUM ('owner', 'admin', 'research_lead', 'researcher', 'analyst', 'viewer');

-- CreateTable
CREATE TABLE "ResearchClient" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "description" TEXT,
    "contacts" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ResearchClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBrand" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "description" TEXT,
    "market" TEXT,
    "competitors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ResearchBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProject" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "clientId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "researchType" TEXT,
    "status" "ResearchProjectStatus" NOT NULL DEFAULT 'draft',
    "ownerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "plan" JSONB NOT NULL DEFAULT '{}',
    "goals" JSONB NOT NULL DEFAULT '[]',
    "researchQuestions" JSONB NOT NULL DEFAULT '[]',
    "hypotheses" JSONB NOT NULL DEFAULT '[]',
    "methods" JSONB NOT NULL DEFAULT '[]',
    "audience" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProjectMember" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ResearchMemberRole" NOT NULL,

    CONSTRAINT "ResearchProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProjectSurvey" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "researchProjectId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "addedById" TEXT,

    CONSTRAINT "ResearchProjectSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchActivity" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "researchProjectId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ResearchActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchClient_organizationId_name_idx" ON "ResearchClient"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchClient_organizationId_name_key" ON "ResearchClient"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ResearchBrand_organizationId_name_idx" ON "ResearchBrand"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ResearchBrand_clientId_idx" ON "ResearchBrand"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchBrand_organizationId_name_key" ON "ResearchBrand"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ResearchProject_organizationId_status_updated_at_idx" ON "ResearchProject"("organizationId", "status", "updated_at");

-- CreateIndex
CREATE INDEX "ResearchProject_clientId_idx" ON "ResearchProject"("clientId");

-- CreateIndex
CREATE INDEX "ResearchProject_brandId_idx" ON "ResearchProject"("brandId");

-- CreateIndex
CREATE INDEX "ResearchProject_ownerId_idx" ON "ResearchProject"("ownerId");

-- CreateIndex
CREATE INDEX "ResearchProject_workspaceId_idx" ON "ResearchProject"("workspaceId");

-- CreateIndex
CREATE INDEX "ResearchProject_organizationId_isFavorite_idx" ON "ResearchProject"("organizationId", "isFavorite");

-- CreateIndex
CREATE INDEX "ResearchProjectMember_userId_idx" ON "ResearchProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProjectMember_researchProjectId_userId_key" ON "ResearchProjectMember"("researchProjectId", "userId");

-- CreateIndex
CREATE INDEX "ResearchProjectSurvey_surveyId_idx" ON "ResearchProjectSurvey"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProjectSurvey_researchProjectId_surveyId_key" ON "ResearchProjectSurvey"("researchProjectId", "surveyId");

-- CreateIndex
CREATE INDEX "ResearchActivity_researchProjectId_created_at_idx" ON "ResearchActivity"("researchProjectId", "created_at");

-- CreateIndex
CREATE INDEX "ResearchActivity_actorId_idx" ON "ResearchActivity"("actorId");

-- AddForeignKey
ALTER TABLE "ResearchClient" ADD CONSTRAINT "ResearchClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBrand" ADD CONSTRAINT "ResearchBrand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBrand" ADD CONSTRAINT "ResearchBrand_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ResearchClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ResearchClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "ResearchBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectMember" ADD CONSTRAINT "ResearchProjectMember_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectMember" ADD CONSTRAINT "ResearchProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectSurvey" ADD CONSTRAINT "ResearchProjectSurvey_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectSurvey" ADD CONSTRAINT "ResearchProjectSurvey_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectSurvey" ADD CONSTRAINT "ResearchProjectSurvey_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchActivity" ADD CONSTRAINT "ResearchActivity_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchActivity" ADD CONSTRAINT "ResearchActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
