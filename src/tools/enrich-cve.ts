import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchNvdCve } from "../api/nvd.js";
import { lookupKev } from "../api/kev.js";
import type { EnrichedCVE } from "../types.js";

export function registerEnrichCveTool(server: McpServer, _repoPath: string): void {
  server.registerTool(
    "enrich_cve",
    {
      title: "Enrich CVE",
      description:
        "Fetch enrichment data for a specific CVE ID: CVSS vectors and score from NVD, CWE weakness classification, references, and whether it appears in the CISA Known Exploited Vulnerabilities (KEV) catalog. Gracefully degrades if NVD or KEV are unavailable.",
      inputSchema: {
        cve_id: z.string().describe("The CVE ID to enrich, e.g. CVE-2021-44228"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ cve_id }) => {
      const [nvdResult, kevResult] = await Promise.all([
        fetchNvdCve(cve_id).catch(() => null),
        lookupKev(cve_id).catch(() => ({ result: { inKEV: false }, available: false })),
      ]);

      const enriched: EnrichedCVE = {
        cveId: cve_id,
        nvd: nvdResult ?? undefined,
        kev: kevResult.result,
        nvdAvailable: nvdResult !== null,
        kevAvailable: kevResult.available,
      };

      const lines: string[] = [`## Enrichment: ${cve_id}\n`];

      // NVD section
      if (!enriched.nvdAvailable) {
        lines.push("### NVD\n⚠️ NVD data unavailable (network error or rate limit reached)\n");
      } else if (!enriched.nvd) {
        lines.push("### NVD\nNo NVD record found for this CVE ID.\n");
      } else {
        const n = enriched.nvd;
        lines.push("### NVD");
        if (n.cvssV3BaseScore !== undefined) {
          lines.push(`**CVSS v3 Score**: ${n.cvssV3BaseScore} (${n.cvssV3Severity ?? ""})`);
        }
        if (n.cvssV3Vector) {
          lines.push(`**Vector**: \`${n.cvssV3Vector}\``);
        }
        if (n.cweIds.length > 0) {
          lines.push(`**CWE**: ${n.cweIds.join(", ")}`);
        }
        if (n.references.length > 0) {
          lines.push(`**References**:`);
          for (const ref of n.references.slice(0, 5)) {
            lines.push(`  - ${ref}`);
          }
          if (n.references.length > 5) {
            lines.push(`  …and ${n.references.length - 5} more`);
          }
        }
        lines.push("");
      }

      // KEV section
      if (!enriched.kevAvailable) {
        lines.push("### CISA KEV\n⚠️ KEV catalog unavailable (network error)\n");
      } else if (!enriched.kev?.inKEV) {
        lines.push("### CISA KEV\n✅ Not in CISA Known Exploited Vulnerabilities catalog.\n");
      } else {
        const k = enriched.kev;
        lines.push("### CISA KEV");
        lines.push("🚨 **ACTIVELY EXPLOITED** — This CVE is in the CISA KEV catalog.");
        if (k.dateAdded) lines.push(`Added to KEV: ${k.dateAdded}`);
        if (k.shortDescription) lines.push(`Description: ${k.shortDescription}`);
        if (k.requiredAction) lines.push(`Required Action: ${k.requiredAction}`);
        if (k.dueDate) lines.push(`CISA Due Date: ${k.dueDate}`);
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
