import "server-only";
import { parse } from "csv-parse/sync";
import * as xlsx from "xlsx";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const MAX_DATASET_ROWS = 5000;

export type TResearchDatasetFieldType = "string" | "number" | "boolean" | "date" | "categorical";

export type TResearchDatasetField = {
  id: string;
  name: string;
  type: TResearchDatasetFieldType;
};

const inferFieldType = (values: unknown[]): TResearchDatasetFieldType => {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (nonEmpty.length === 0) return "string";

  const allNumbers = nonEmpty.every((v) => {
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "string") return v.trim() !== "" && !Number.isNaN(Number(v));
    return false;
  });
  if (allNumbers) return "number";

  const allBool = nonEmpty.every((v) => {
    const s = String(v).toLowerCase();
    return s === "true" || s === "false" || s === "1" || s === "0" || s === "yes" || s === "no";
  });
  if (allBool) return "boolean";

  const unique = new Set(nonEmpty.map((v) => String(v)));
  if (unique.size > 0 && unique.size <= Math.min(20, Math.ceil(nonEmpty.length * 0.5))) {
    return "categorical";
  }

  return "string";
};

const normalizeHeader = (header: string, index: number): string => {
  const trimmed = header.trim();
  return trimmed || `column_${index + 1}`;
};

const rowsFromMatrix = (matrix: unknown[][]): { fields: TResearchDatasetField[]; rows: Array<Record<string, unknown>> } => {
  if (matrix.length === 0) {
    throw new InvalidInputError("Dataset is empty");
  }

  const headerRow = matrix[0].map((cell, idx) => normalizeHeader(String(cell ?? ""), idx));
  const fields: TResearchDatasetField[] = headerRow.map((name) => ({
    id: createId(),
    name,
    type: "string",
  }));

  const dataRows = matrix.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (dataRows.length === 0) {
    throw new InvalidInputError("Dataset has headers but no data rows");
  }
  if (dataRows.length > MAX_DATASET_ROWS) {
    throw new InvalidInputError(`Dataset exceeds maximum of ${MAX_DATASET_ROWS} rows`);
  }

  const rows = dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    fields.forEach((field, idx) => {
      obj[field.id] = row[idx] ?? null;
    });
    return obj;
  });

  fields.forEach((field) => {
    field.type = inferFieldType(rows.map((r) => r[field.id]));
  });

  // Coerce numbers
  for (const field of fields) {
    if (field.type !== "number") continue;
    for (const row of rows) {
      const n = Number(row[field.id]);
      row[field.id] = Number.isFinite(n) ? n : null;
    }
  }

  return { fields, rows };
};

export const parseCsvDataset = (content: string) => {
  const records = parse(content, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  }) as unknown[][];
  return rowsFromMatrix(records);
};

export const parseXlsxDataset = (buffer: Buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new InvalidInputError("Workbook has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const matrix = xlsx.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];
  return rowsFromMatrix(matrix);
};

export const createResearchDatasetFromParsed = async (params: {
  researchProjectId: string;
  name: string;
  description?: string;
  sourceType: "csv" | "xlsx" | "manual";
  fileName?: string;
  fields: TResearchDatasetField[];
  rows: Array<Record<string, unknown>>;
  actorId: string;
}) => {
  validateInputs([params.researchProjectId, ZId]);

  try {
    const dataset = await prisma.$transaction(async (tx) => {
      const created = await tx.researchDataset.create({
        data: {
          researchProjectId: params.researchProjectId,
          name: params.name.trim(),
          description: params.description ?? null,
          sourceType: params.sourceType,
          fileName: params.fileName ?? null,
          rowCount: params.rows.length,
          fields: params.fields as unknown as Prisma.InputJsonValue,
          rows: params.rows as unknown as Prisma.InputJsonValue,
          createdById: params.actorId,
        },
      });

      await tx.researchActivity.create({
        data: {
          researchProjectId: params.researchProjectId,
          actorId: params.actorId,
          action: "dataset_imported",
          targetType: "dataset",
          targetId: created.id,
          metadata: { name: created.name, rowCount: params.rows.length, sourceType: params.sourceType },
        },
      });

      return created;
    });

    return dataset;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new InvalidInputError("A dataset with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const listResearchDatasets = reactCache(async (researchProjectId: string) => {
  validateInputs([researchProjectId, ZId]);
  return prisma.researchDataset.findMany({
    where: { researchProjectId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      sourceType: true,
      fileName: true,
      rowCount: true,
      fields: true,
      createdAt: true,
      updatedAt: true,
    },
  });
});

export const getResearchDataset = reactCache(async (datasetId: string) => {
  validateInputs([datasetId, ZId]);
  return prisma.researchDataset.findUnique({ where: { id: datasetId } });
});

export const deleteResearchDataset = async (datasetId: string, actorId: string) => {
  validateInputs([datasetId, ZId]);
  const existing = await prisma.researchDataset.findUnique({
    where: { id: datasetId },
    select: { id: true, researchProjectId: true, name: true },
  });
  if (!existing) throw new ResourceNotFoundError("ResearchDataset", datasetId);

  await prisma.$transaction(async (tx) => {
    await tx.researchDataset.delete({ where: { id: datasetId } });
    await tx.researchActivity.create({
      data: {
        researchProjectId: existing.researchProjectId,
        actorId,
        action: "dataset_deleted",
        targetType: "dataset",
        targetId: datasetId,
        metadata: { name: existing.name },
      },
    });
  });

  return { success: true };
};
