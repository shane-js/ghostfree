import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { discoverDependencies } from "../parsers/index.js";
import { setCachedDeps } from "../dep-cache.js";
import type { Dependency } from "../types.js";

export function registerDiscoverTool(server: McpServer, repoPath: string): void {
  server.registerTool(
    "discover_dependencies",
    {
      title: "Discover Dependencies",
      description:
        "Scan the repository for manifest files (requirements.txt, package.json, go.mod, Cargo.toml, pom.xml, *.csproj, Dockerfiles, etc.) and return all pinned dependencies grouped by ecosystem.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const deps = await discoverDependencies(repoPath);
      setCachedDeps(deps);

      if (deps.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No manifest files found in the repository. Ensure the repo path is correct and contains supported manifest files.",
            },
          ],
        };
      }

      // Group by ecosystem
      const byEcosystem = new Map<string, Dependency[]>();
      for (const dep of deps) {
        const list = byEcosystem.get(dep.ecosystem) ?? [];
        list.push(dep);
        byEcosystem.set(dep.ecosystem, list);
      }

      const lines: string[] = [`Found ${deps.length} dependencies across ${byEcosystem.size} ecosystem(s):\n`];
      for (const [ecosystem, pkgs] of byEcosystem) {
        lines.push(`**${ecosystem}** (${pkgs.length})`);
        for (const p of pkgs) {
          lines.push(`  ${p.name}@${p.version}`);
        }
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
