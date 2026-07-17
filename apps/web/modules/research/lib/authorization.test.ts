import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertResearchCapability, roleHasCapability } from "./authorization";

const mocks = vi.hoisted(() => ({
  researchProjectFindUnique: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    researchProject: {
      findUnique: mocks.researchProjectFindUnique,
    },
  },
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));

describe("roleHasCapability", () => {
  test("org_admin has all capabilities", () => {
    expect(roleHasCapability("org_admin", "delete")).toBe(true);
    expect(roleHasCapability("org_admin", "view")).toBe(true);
  });

  test("viewer cannot edit", () => {
    expect(roleHasCapability("viewer", "view")).toBe(true);
    expect(roleHasCapability("viewer", "edit")).toBe(false);
    expect(roleHasCapability("viewer", "link_surveys")).toBe(false);
  });

  test("researcher can link surveys but cannot archive", () => {
    expect(roleHasCapability("researcher", "link_surveys")).toBe(true);
    expect(roleHasCapability("researcher", "edit_interviews")).toBe(true);
    expect(roleHasCapability("researcher", "archive")).toBe(false);
  });

  test("analyst can edit analysis and create insights but not interviews", () => {
    expect(roleHasCapability("analyst", "edit_analysis")).toBe(true);
    expect(roleHasCapability("analyst", "create_insights")).toBe(true);
    expect(roleHasCapability("analyst", "edit_interviews")).toBe(false);
  });

  test("analyst can edit reports but cannot approve", () => {
    expect(roleHasCapability("analyst", "edit_reports")).toBe(true);
    expect(roleHasCapability("analyst", "approve_reports")).toBe(false);
  });

  test("analyst can edit brand audit", () => {
    expect(roleHasCapability("analyst", "edit_brand_audit")).toBe(true);
    expect(roleHasCapability("viewer", "edit_brand_audit")).toBe(false);
  });
});

describe("assertResearchCapability", () => {
  const userId = createId();
  const projectId = createId();
  const organizationId = createId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when project is missing", async () => {
    mocks.researchProjectFindUnique.mockResolvedValue(null);
    await expect(assertResearchCapability(userId, projectId, "view")).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );
  });

  test("allows organization owner as org_admin", async () => {
    mocks.researchProjectFindUnique.mockResolvedValue({
      id: projectId,
      organizationId,
      ownerId: createId(),
      members: [],
    });
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({
      accepted: true,
      role: "owner",
    });

    const access = await assertResearchCapability(userId, projectId, "delete");
    expect(access.role).toBe("org_admin");
  });

  test("allows explicit research member role", async () => {
    mocks.researchProjectFindUnique.mockResolvedValue({
      id: projectId,
      organizationId,
      ownerId: createId(),
      members: [{ role: "researcher" }],
    });
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({
      accepted: true,
      role: "member",
    });

    const access = await assertResearchCapability(userId, projectId, "link_surveys");
    expect(access.role).toBe("researcher");
  });

  test("denies capability the role does not have", async () => {
    mocks.researchProjectFindUnique.mockResolvedValue({
      id: projectId,
      organizationId,
      ownerId: createId(),
      members: [{ role: "viewer" }],
    });
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({
      accepted: true,
      role: "member",
    });

    await expect(assertResearchCapability(userId, projectId, "edit")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  test("denies billing membership", async () => {
    mocks.researchProjectFindUnique.mockResolvedValue({
      id: projectId,
      organizationId,
      ownerId: createId(),
      members: [],
    });
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({
      accepted: true,
      role: "billing",
    });

    await expect(assertResearchCapability(userId, projectId, "view")).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });
});
