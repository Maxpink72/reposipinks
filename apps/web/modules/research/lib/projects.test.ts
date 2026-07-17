import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZCreateResearchProjectInput, ZResearchProjectListFilters } from "../types";

describe("research zod schemas", () => {
  test("accepts valid create input", () => {
    const parsed = ZCreateResearchProjectInput.parse({
      organizationId: createId(),
      name: "Brand audit",
      methods: ["brand_audit"],
    });
    expect(parsed.name).toBe("Brand audit");
    expect(parsed.methods).toEqual(["brand_audit"]);
  });

  test("rejects empty project name", () => {
    expect(() =>
      ZCreateResearchProjectInput.parse({
        organizationId: createId(),
        name: "   ",
      })
    ).toThrow();
  });

  test("parses list filters with defaults omitted", () => {
    const parsed = ZResearchProjectListFilters.parse({
      organizationId: createId(),
      status: "draft",
      includeArchived: true,
    });
    expect(parsed.status).toBe("draft");
    expect(parsed.includeArchived).toBe(true);
  });
});

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: mocks.transaction,
    researchProject: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("createResearchProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("creates project with owner membership and activity", async () => {
    const organizationId = createId();
    const actorId = createId();
    const projectId = createId();

    mocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<string>) => {
      const tx = {
        researchClient: {
          upsert: vi.fn().mockResolvedValue({ id: createId() }),
        },
        researchBrand: {
          upsert: vi.fn().mockResolvedValue({ id: createId() }),
        },
        researchProject: {
          create: vi.fn().mockResolvedValue({ id: projectId }),
        },
        researchActivity: {
          create: vi.fn().mockResolvedValue({ id: createId() }),
        },
      };
      return cb(tx);
    });

    mocks.findUnique.mockResolvedValue({
      id: projectId,
      name: "Study",
      organizationId,
      client: { id: createId(), name: "Acme" },
      brand: { id: createId(), name: "Acme Brand" },
      owner: { id: actorId, name: "Ada", email: "ada@example.com" },
      members: [],
      surveys: [],
      _count: { surveys: 0, members: 1, activity: 1 },
    });

    const { createResearchProject } = await import("./projects");
    const result = await createResearchProject(
      {
        organizationId,
        name: "Study",
        clientName: "Acme",
        brandName: "Acme Brand",
      },
      actorId
    );

    expect(result.id).toBe(projectId);
    expect(mocks.transaction).toHaveBeenCalled();
  });
});
