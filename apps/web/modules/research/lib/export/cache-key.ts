import { createHash } from "node:crypto";

export const sha256Hex = (data: Buffer | string): string =>
  createHash("sha256").update(data).digest("hex");

export const buildExportCacheKey = (parts: {
  reportId: string;
  reportVersionId?: string | null;
  snapshotHash: string;
  optionsHash: string;
}): string =>
  sha256Hex(
    `${parts.reportId}:${parts.reportVersionId ?? "live"}:${parts.snapshotHash}:${parts.optionsHash}`
  );
