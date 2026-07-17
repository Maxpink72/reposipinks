-- CreateEnum
CREATE TYPE "ResearchInterviewStatus" AS ENUM ('planned', 'scheduled', 'completed', 'transcribed', 'coded', 'analyzed');

-- CreateEnum
CREATE TYPE "ResearchInsightType" AS ENUM ('finding', 'pattern', 'tension', 'need', 'motivation', 'barrier', 'opportunity', 'hypothesis', 'recommendation');

-- CreateEnum
CREATE TYPE "ResearchInsightConfidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ResearchInsightImportance" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "ResearchInterview" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "respondentName" TEXT,
    "respondentSegment" TEXT,
    "interviewerId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "ResearchInterviewStatus" NOT NULL DEFAULT 'planned',
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "mediaUrl" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "linkedQuestionIds" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ResearchInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTranscript" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "interviewId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL DEFAULT '',
    "language" TEXT DEFAULT 'ru-RU',
    "source" TEXT NOT NULL DEFAULT 'paste',

    CONSTRAINT "ResearchTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTranscriptSegment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "speaker" TEXT,
    "text" TEXT NOT NULL,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "notes" TEXT,
    "isQuote" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResearchTranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCode" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "mergedIntoId" TEXT,

    CONSTRAINT "ResearchCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTranscriptSegmentCode" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segmentId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ResearchTranscriptSegmentCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchInsight" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "researchProjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResearchInsightType" NOT NULL DEFAULT 'finding',
    "confidence" "ResearchInsightConfidence" NOT NULL DEFAULT 'medium',
    "importance" "ResearchInsightImportance" NOT NULL DEFAULT 'medium',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "linkedQuestionIds" JSONB NOT NULL DEFAULT '[]',
    "authorId" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isHumanConfirmed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ResearchInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchInsightEvidence" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insightId" TEXT NOT NULL,
    "interviewId" TEXT,
    "segmentId" TEXT,
    "quoteText" TEXT,
    "note" TEXT,
    "responseId" TEXT,

    CONSTRAINT "ResearchInsightEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchInterview_researchProjectId_status_scheduledAt_idx" ON "ResearchInterview"("researchProjectId", "status", "scheduledAt");
CREATE INDEX "ResearchInterview_interviewerId_idx" ON "ResearchInterview"("interviewerId");
CREATE INDEX "ResearchInterview_researchProjectId_respondentSegment_idx" ON "ResearchInterview"("researchProjectId", "respondentSegment");

CREATE UNIQUE INDEX "ResearchTranscript_interviewId_key" ON "ResearchTranscript"("interviewId");
CREATE INDEX "ResearchTranscript_interviewId_idx" ON "ResearchTranscript"("interviewId");

CREATE UNIQUE INDEX "ResearchTranscriptSegment_transcriptId_position_key" ON "ResearchTranscriptSegment"("transcriptId", "position");
CREATE INDEX "ResearchTranscriptSegment_transcriptId_position_idx" ON "ResearchTranscriptSegment"("transcriptId", "position");

CREATE UNIQUE INDEX "ResearchCode_researchProjectId_name_key" ON "ResearchCode"("researchProjectId", "name");
CREATE INDEX "ResearchCode_researchProjectId_idx" ON "ResearchCode"("researchProjectId");
CREATE INDEX "ResearchCode_mergedIntoId_idx" ON "ResearchCode"("mergedIntoId");

CREATE UNIQUE INDEX "ResearchTranscriptSegmentCode_segmentId_codeId_key" ON "ResearchTranscriptSegmentCode"("segmentId", "codeId");
CREATE INDEX "ResearchTranscriptSegmentCode_codeId_idx" ON "ResearchTranscriptSegmentCode"("codeId");
CREATE INDEX "ResearchTranscriptSegmentCode_segmentId_idx" ON "ResearchTranscriptSegmentCode"("segmentId");

CREATE INDEX "ResearchInsight_researchProjectId_type_importance_idx" ON "ResearchInsight"("researchProjectId", "type", "importance");
CREATE INDEX "ResearchInsight_authorId_idx" ON "ResearchInsight"("authorId");
CREATE INDEX "ResearchInsight_researchProjectId_created_at_idx" ON "ResearchInsight"("researchProjectId", "created_at");

CREATE INDEX "ResearchInsightEvidence_insightId_idx" ON "ResearchInsightEvidence"("insightId");
CREATE INDEX "ResearchInsightEvidence_interviewId_idx" ON "ResearchInsightEvidence"("interviewId");
CREATE INDEX "ResearchInsightEvidence_segmentId_idx" ON "ResearchInsightEvidence"("segmentId");

-- AddForeignKey
ALTER TABLE "ResearchInterview" ADD CONSTRAINT "ResearchInterview_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchInterview" ADD CONSTRAINT "ResearchInterview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchTranscript" ADD CONSTRAINT "ResearchTranscript_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "ResearchInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchTranscriptSegment" ADD CONSTRAINT "ResearchTranscriptSegment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "ResearchTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchCode" ADD CONSTRAINT "ResearchCode_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCode" ADD CONSTRAINT "ResearchCode_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "ResearchCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchTranscriptSegmentCode" ADD CONSTRAINT "ResearchTranscriptSegmentCode_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ResearchTranscriptSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchTranscriptSegmentCode" ADD CONSTRAINT "ResearchTranscriptSegmentCode_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ResearchCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchInsight" ADD CONSTRAINT "ResearchInsight_researchProjectId_fkey" FOREIGN KEY ("researchProjectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchInsight" ADD CONSTRAINT "ResearchInsight_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchInsightEvidence" ADD CONSTRAINT "ResearchInsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "ResearchInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchInsightEvidence" ADD CONSTRAINT "ResearchInsightEvidence_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "ResearchInterview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchInsightEvidence" ADD CONSTRAINT "ResearchInsightEvidence_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ResearchTranscriptSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
