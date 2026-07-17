import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const recordResearchActivity = async (params: {
  researchProjectId: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  validateInputs([params.researchProjectId, ZId]);

  try {
    await prisma.researchActivity.create({
      data: {
        researchProjectId: params.researchProjectId,
        actorId: params.actorId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getResearchActivity = async (researchProjectId: string, limit = 30) => {
  validateInputs([researchProjectId, ZId]);

  return prisma.researchActivity.findMany({
    where: { researchProjectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: { id: true, name: true, email: true },
      },
    },
  });
};
