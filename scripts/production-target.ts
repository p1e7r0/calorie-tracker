import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

export const neonMainEnvironmentFile = ".env.neon-main";

const productionUrlNames = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

export type ProductionUrls = Record<(typeof productionUrlNames)[number], string>;

export type NeonEndpoint = { id: string; branchId: string };

export type NeonBranch = { id: string; name: string };

export function readProductionUrls(variables: Record<string, string | undefined>): ProductionUrls {
  const missing = productionUrlNames.filter((name) => !variables[name]);
  if (missing.length > 0) {
    throw new Error(`${neonMainEnvironmentFile} must define ${missing.join(" and ")}.`);
  }
  return { DATABASE_URL: variables.DATABASE_URL!, DATABASE_URL_UNPOOLED: variables.DATABASE_URL_UNPOOLED! };
}

export function loadNeonMainUrls(directory = process.cwd()): ProductionUrls {
  let text: string;
  try {
    text = readFileSync(join(directory, neonMainEnvironmentFile), "utf8");
  } catch {
    throw new Error(`Missing ${neonMainEnvironmentFile} with the connection strings of the Neon main branch.`);
  }
  return readProductionUrls(parseEnv(text));
}

export function endpointIdFromUrl(connectionString: string) {
  return new URL(connectionString).hostname.split(".")[0].replace(/-pooler$/, "");
}

export function findProductionTargetProblem(urls: ProductionUrls, endpoints: NeonEndpoint[], branches: NeonBranch[]) {
  const endpointIds = [...new Set(Object.values(urls).map(endpointIdFromUrl))];
  if (endpointIds.length !== 1) {
    return `DATABASE_URL and DATABASE_URL_UNPOOLED point to different endpoints (${endpointIds.join(", ")}).`;
  }
  const endpoint = endpoints.find((candidate) => candidate.id === endpointIds[0]);
  if (!endpoint) {
    return `Endpoint ${endpointIds[0]} does not exist in your Neon projects.`;
  }
  const branch = branches.find((candidate) => candidate.id === endpoint.branchId);
  if (branch?.name !== "main") {
    return `Endpoint ${endpoint.id} belongs to branch ${branch?.name ?? endpoint.branchId}, not main.`;
  }
  return null;
}
