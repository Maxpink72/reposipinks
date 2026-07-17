/**
 * Splits raw transcript text into segments.
 * Supports:
 * - Speaker labels: "Interviewer: …" / "Respondent: …" / "Имя:"
 * - Blank-line separated paragraphs
 * - Fallback: single segment with full text
 */
export type TParsedTranscriptSegment = {
  position: number;
  speaker: string | null;
  text: string;
};

const SPEAKER_LINE = /^([A-Za-zА-Яа-яЁё0-9 _.-]{1,80})\s*[:：]\s*(.+)$/u;

export const parseTranscriptText = (rawText: string): TParsedTranscriptSegment[] => {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const segments: TParsedTranscriptSegment[] = [];
  let position = 0;

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Multi-line block where each line may have a speaker
    const lineSegments: TParsedTranscriptSegment[] = [];
    for (const line of lines) {
      const match = line.match(SPEAKER_LINE);
      if (match) {
        lineSegments.push({
          position: 0,
          speaker: match[1].trim(),
          text: match[2].trim(),
        });
      } else if (lineSegments.length > 0) {
        // continuation of previous speaker line
        const last = lineSegments[lineSegments.length - 1];
        last.text = `${last.text} ${line}`.trim();
      } else {
        lineSegments.push({ position: 0, speaker: null, text: line });
      }
    }

    if (lineSegments.length === 1 && lineSegments[0].speaker === null && lines.length > 1) {
      segments.push({
        position: position++,
        speaker: null,
        text: lines.join(" ").trim(),
      });
    } else {
      for (const seg of lineSegments) {
        if (!seg.text) continue;
        segments.push({
          position: position++,
          speaker: seg.speaker,
          text: seg.text,
        });
      }
    }
  }

  if (segments.length === 0) {
    return [{ position: 0, speaker: null, text: normalized }];
  }

  return segments;
};
