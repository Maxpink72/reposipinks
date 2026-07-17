import "server-only";
import { prisma } from "@formbricks/database";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  RESEARCH_ROLE_CAPABILITIES,
  type TResearchCapability,
  type TResearchMemberRole,
} from "@/modules/research/types";

type TResearchAccessContext = {
  organizationId: string;
  researchProjectId: string;
  role: TResearchMemberRole | "org_admin";
};

const hasCapability = (role: TResearchAccessContext["role"], capability: TResearchCapability): boolean => {
  if (role === "org_admin") {
    return true;
  }
  return RESEARCH_ROLE_CAPABILITIES[role].includes(capability);
};

/**
 * Resolves research access for a user.
 * Organization owners/managers get implicit admin on all research projects.
 * Other members need an explicit ResearchProjectMember row (or be the project owner).
 */
export const getResearchAccessContext = async (
  userId: string,
  researchProjectId: string
): Promise<TResearchAccessContext> => {
  const project = await prisma.researchProject.findUnique({
    where: { id: researchProjectId },
    select: {
      id: true,
      organizationId: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new ResourceNotFoundError("ResearchProject", researchProjectId);
  }

  const membership = await getMembershipByUserIdOrganizationId(userId, project.organizationId);
  if (!membership?.accepted) {
    throw new AuthorizationError("Not authorized");
  }

  const { isOwner, isManager } = getAccessFlags(membership.role);
  if (isOwner || isManager) {
    return {
      organizationId: project.organizationId,
      researchProjectId: project.id,
      role: "org_admin",
    };
  }

  if (membership.role === "billing") {
    throw new AuthorizationError("Not authorized");
  }

  const memberRole = project.members[0]?.role as TResearchMemberRole | undefined;
  if (memberRole) {
    return {
      organizationId: project.organizationId,
      researchProjectId: project.id,
      role: memberRole,
    };
  }

  if (project.ownerId === userId) {
    return {
      organizationId: project.organizationId,
      researchProjectId: project.id,
      role: "owner",
    };
  }

  throw new AuthorizationError("Not authorized");
};

export const assertResearchCapability = async (
  userId: string,
  researchProjectId: string,
  capability: TResearchCapability
): Promise<TResearchAccessContext> => {
  const access = await getResearchAccessContext(userId, researchProjectId);
  if (!hasCapability(access.role, capability)) {
    throw new AuthorizationError("Not authorized");
  }
  return access;
};

export const canAccessOrganizationResearch = async (
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership?.accepted) {
    return false;
  }
  const { isBilling } = getAccessFlags(membership.role);
  return !isBilling;
};

export const assertCanAccessOrganizationResearch = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  const allowed = await canAccessOrganizationResearch(userId, organizationId);
  if (!allowed) {
    throw new AuthorizationError("Not authorized");
  }
};

export const roleHasCapability = (
  role: TResearchMemberRole | "org_admin",
  capability: TResearchCapability
): boolean => hasCapability(role, capability);
