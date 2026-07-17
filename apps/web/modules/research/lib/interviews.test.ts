import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { roleHasCapability } from "./authorization";
import { ZCreateInsightFromSegmentInput, ZCreateResearchInterviewInput } from "../types";

describe("stage 2 capabilities", () => {
  test("researcher can edit interviews and create insights", () => {
    expect(roleHasCapability("researcher", "edit_interviews")).toBe(true);
    expect(roleHasCapability("researcher", "create_insights")).toBe(true);
  });

  test("analyst cannot edit interviews but can create insights", () => {
    expect(roleHasCapability("analyst", "edit_interviews")).toBe(false);
    expect(roleHasCapability("analyst", "create_insights")).toBe(true);
  });

  test("viewer cannot create insights", () => {
    expect(roleHasCapability("viewer", "create_insights")).toBe(false);
  });
});

describe("qualitative zod schemas", () => {
  test("accepts interview create input", () => {
    const parsed = ZCreateResearchInterviewInput.parse({
      researchProjectId: createId(),
      name: "Depth interview 1",
      respondentSegment: "SMB decision makers",
    });
    expect(parsed.name).toBe("Depth interview 1");
  });

  test("accepts insight-from-segment input", () => {
    const parsed = ZCreateInsightFromSegmentInput.parse({
      researchProjectId: createId(),
      segmentId: createId(),
      title: "Trust is a key motivator",
      type: "motivation",
    });
    expect(parsed.type).toBe("motivation");
  });
});

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: mocks.transaction,
    researchInterview: {
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("importInterviewTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("replaces segments and marks interview transcribed", async () => {
    const interviewId = createId();
    const projectId = createId();
    const transcriptId = createId();
    const actorId = createId();

    mocks.findUnique
      .mockResolvedValueOnce({ id: interviewId, researchProjectId: projectId })
      .mockResolvedValueOnce({
        id: interviewId,
        researchProjectId: projectId,
        name: "Interview",
        status: "transcribed",
        interviewer: null,
        transcript: {
          id: transcriptId,
          rawText: "Interviewer: Hello?\n\nRespondent: Yes.",
          segments: [
            { id: createId(), position: 0, speaker: "Interviewer", text: "Hello?", codes: [], isQuote: false },
            { id: createId(), position: 1, speaker: "Respondent", text: "Yes.", codes: [], isQuote: false },
          ],
        },
      });

    mocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        researchTranscript: {
          upsert: vi.fn().mockResolvedValue({ id: transcriptId }),
        },
        researchTranscriptSegmentCode: {
          deleteMany: vi.fn(),
        },
        researchTranscriptSegment: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        researchInterview: {
          update: vi.fn(),
        },
        researchActivity: {
          create: vi.fn(),
        },
      };
      await cb(tx);
      expect(tx.researchTranscriptSegment.createMany).toHaveBeenCalled();
      expect(tx.researchInterview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "transcribed" },
        })
      );
    });

    const { importInterviewTranscript } = await import("./interviews");
    const result = await importInterviewTranscript(
      {
        interviewId,
        rawText: "Interviewer: Hello?\n\nRespondent: Yes.",
      },
      actorId
    );

    expect(result.status).toBe("transcribed");
    expect(result.transcript?.segments).toHaveLength(2);
  });
});
