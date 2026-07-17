/**
 * AI extension stubs for qualitative analysis.
 * MVP does not call any provider — architecture hooks only.
 * Future results MUST set isAiGenerated=true and require human confirmation.
 */

export type TResearchAiStubResult<T> = {
  available: false;
  reason: "ai_not_enabled_in_mvp";
  suggestedPayload?: T;
};

export const summarizeInterviewStub = async (_interviewId: string): Promise<TResearchAiStubResult<{ summary: string }>> => ({
  available: false,
  reason: "ai_not_enabled_in_mvp",
});

export const extractThemesStub = async (
  _researchProjectId: string
): Promise<TResearchAiStubResult<{ themes: string[] }>> => ({
  available: false,
  reason: "ai_not_enabled_in_mvp",
});

export const analyzeSentimentStub = async (
  _segmentId: string
): Promise<TResearchAiStubResult<{ sentiment: "positive" | "neutral" | "negative" }>> => ({
  available: false,
  reason: "ai_not_enabled_in_mvp",
});

export const extractQuotesStub = async (
  _interviewId: string
): Promise<TResearchAiStubResult<{ quotes: string[] }>> => ({
  available: false,
  reason: "ai_not_enabled_in_mvp",
});
