import { describe, expect, test } from "vitest";
import { parseTranscriptText } from "./transcript-parser";

describe("parseTranscriptText", () => {
  test("parses speaker-labeled lines", () => {
    const segments = parseTranscriptText(
      "Interviewer: How do you feel about the brand?\n\nRespondent: It feels trustworthy and calm."
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      position: 0,
      speaker: "Interviewer",
      text: "How do you feel about the brand?",
    });
    expect(segments[1].speaker).toBe("Respondent");
  });

  test("parses paragraph blocks without speakers", () => {
    const segments = parseTranscriptText("First thought about the brand.\n\nSecond thought with more detail.");
    expect(segments).toHaveLength(2);
    expect(segments[0].speaker).toBeNull();
    expect(segments[0].text).toContain("First thought");
  });

  test("returns empty array for blank input", () => {
    expect(parseTranscriptText("   \n\n  ")).toEqual([]);
  });

  test("supports Cyrillic speaker labels", () => {
    const segments = parseTranscriptText("Интервьюер: Расскажите о бренде.\n\nРеспондент: Он кажется надёжным.");
    expect(segments).toHaveLength(2);
    expect(segments[0].speaker).toBe("Интервьюер");
    expect(segments[1].text).toContain("надёжным");
  });
});
