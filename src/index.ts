#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { registerDiscoverTool } from "./tools/discover.js";
import { registerCheckCvesTool } from "./tools/check-cves.js";
import { registerEnrichCveTool } from "./tools/enrich-cve.js";
import { registerAcceptedRisksTools } from "./tools/accepted-risks-tools.js";
import { registerScanPrompt } from "./prompts/scan.js";

// Parse --repo-path CLI argument, fall back to cwd
function resolveRepoPath(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--repo-path");
  if (idx !== -1 && args[idx + 1]) {
    return path.resolve(args[idx + 1]);
  }
  return process.cwd();
}

const repoPath = resolveRepoPath();

// Load .env from the repo root if present — does not override already-set env vars
const dotEnvPath = path.join(repoPath, ".env");
try {
  process.loadEnvFile(dotEnvPath);
  console.error(`[ghostfree] Loaded env from ${dotEnvPath}`);
} catch {
  // .env not present or unreadable — not an error
}

const server = new McpServer({
  name: "ghostfree",
  version: "0.1.0",
});

// Register all tools and the scan prompt
registerDiscoverTool(server, repoPath);
registerCheckCvesTool(server, repoPath);
registerEnrichCveTool(server, repoPath);
registerAcceptedRisksTools(server, repoPath);
registerScanPrompt(server);

// Boot
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[ghostfree] MCP server running on stdio");
