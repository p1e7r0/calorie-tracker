import { describe, expect, it } from "vitest";
import { endpointIdFromUrl, findProductionTargetProblem, readProductionUrls } from "./production-target";

const mainUrls = {
  DATABASE_URL: "postgresql://owner:secret@ep-main-123-pooler.eu-central-1.aws.neon.tech/database?sslmode=require",
  DATABASE_URL_UNPOOLED: "postgresql://owner:secret@ep-main-123.eu-central-1.aws.neon.tech/database?sslmode=require",
};
const endpoints = [
  { id: "ep-main-123", branchId: "br-main" },
  { id: "ep-dev-456", branchId: "br-dev" },
];
const branches = [
  { id: "br-main", name: "main" },
  { id: "br-dev", name: "dev" },
];

describe("readProductionUrls", () => {
  it("returns both connection strings", () => {
    expect(readProductionUrls(mainUrls)).toEqual(mainUrls);
  });

  it("rejects a file without the unpooled connection string", () => {
    expect(() => readProductionUrls({ DATABASE_URL: mainUrls.DATABASE_URL })).toThrow("DATABASE_URL_UNPOOLED");
  });
});

describe("endpointIdFromUrl", () => {
  it("drops the pooler suffix and the domain", () => {
    expect(endpointIdFromUrl(mainUrls.DATABASE_URL)).toBe("ep-main-123");
    expect(endpointIdFromUrl(mainUrls.DATABASE_URL_UNPOOLED)).toBe("ep-main-123");
  });
});

describe("findProductionTargetProblem", () => {
  it("accepts connection strings of the main branch", () => {
    expect(findProductionTargetProblem(mainUrls, endpoints, branches)).toBeNull();
  });

  it("rejects connection strings of another branch", () => {
    const devUrls = {
      DATABASE_URL: "postgresql://owner:secret@ep-dev-456-pooler.eu-central-1.aws.neon.tech/database",
      DATABASE_URL_UNPOOLED: "postgresql://owner:secret@ep-dev-456.eu-central-1.aws.neon.tech/database",
    };
    expect(findProductionTargetProblem(devUrls, endpoints, branches)).toContain("branch dev, not main");
  });

  it("rejects connection strings that point to two endpoints", () => {
    const mixedUrls = { ...mainUrls, DATABASE_URL: "postgresql://owner:secret@ep-dev-456-pooler.eu-central-1.aws.neon.tech/database" };
    expect(findProductionTargetProblem(mixedUrls, endpoints, branches)).toContain("different endpoints");
  });

  it("rejects an endpoint missing from the Neon projects", () => {
    expect(findProductionTargetProblem(mainUrls, [], branches)).toContain("does not exist");
  });
});
