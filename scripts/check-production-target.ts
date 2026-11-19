import { execFileSync } from "node:child_process";
import {
  endpointIdFromUrl,
  findProductionTargetProblem,
  loadNeonMainUrls,
  type NeonBranch,
  type NeonEndpoint,
} from "./production-target";

function neon(commandArguments: string[]) {
  const output = execFileSync("npx", ["neonctl", ...commandArguments], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(output);
}

try {
  const urls = loadNeonMainUrls();
  const projectList = neon(["projects", "list", "--output", "json"]);
  const projects: { id: string }[] = projectList.projects ?? projectList;
  const endpoints: NeonEndpoint[] = [];
  const branches: NeonBranch[] = [];
  for (const project of projects) {
    const endpointList: { endpoints: { id: string; branch_id: string }[] } = neon(["api", `/projects/${project.id}/endpoints`]);
    endpoints.push(...endpointList.endpoints.map((endpoint) => ({ id: endpoint.id, branchId: endpoint.branch_id })));
    const branchList: { branches: NeonBranch[] } = neon(["api", `/projects/${project.id}/branches`]);
    branches.push(...branchList.branches.map((branch) => ({ id: branch.id, name: branch.name })));
  }
  const problem = findProductionTargetProblem(urls, endpoints, branches);
  if (problem) {
    console.error(`Production target check failed: ${problem}`);
    process.exit(1);
  }
  console.log(`Production target check passed: endpoint ${endpointIdFromUrl(urls.DATABASE_URL_UNPOOLED)} on branch main.`);
} catch (error) {
  console.error(`Production target check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
