import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listAcceptedRisks,
  acceptRisk,
  removeAcceptedRisk,
} from "../accepted-risks.js";
import type { Severity } from "../types.js";

export function registerAcceptedRisksTools(server: McpServer, repoPath: string): void {
  // list_accepted_risks
  server.registerTool(
    "list_accepted_risks",
    {
      title: "List Accepted Risks",
      description:
        "List all accepted CVE risks, including whether each acceptance has expired.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const risks = await listAcceptedRisks(repoPath);

      if (risks.length === 0) {
        return { content: [{ type: "text", text: "No accepted risks on file." }] };
      }

      const lines: string[] = [`## Accepted Risks (${risks.length})\n`];
      for (const r of risks) {
        const status = r.isExpired
          ? `⚠️ EXPIRED ${Math.abs(r.daysUntilExpiry)} days ago`
          : `✅ expires in ${r.daysUntilExpiry} days (${r.expires_on})`;
        const severityInfo =
          r.cvss_score_at_acceptance != null
            ? ` | Severity at acceptance: ${r.severity_at_acceptance} (${r.cvss_score_at_acceptance})`
            : ` | Severity at acceptance: ${r.severity_at_acceptance}`;
        lines.push(`**${r.cve_id}** — ${status}${severityInfo}`);
        lines.push(`  ID: ${r.id}`);
        lines.push(`  Reason: ${r.reason}`);
        lines.push(`  Accepted: ${r.accepted_at}\n`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // accept_risk
  server.registerTool(
    "accept_risk",
    {
      title: "Accept Risk",
      description:
        "Record an accepted risk for a CVE, with a reason and mandatory expiry date. Expiry beyond 1 year requires confirm_extended_expiry=true.",
      inputSchema: {
        cve_id: z.string().describe("The CVE ID to accept, e.g. CVE-2021-44228"),
        reason: z.string().describe("Business justification for accepting this risk"),
        expires_on: z
          .string()
          .describe("Expiry date in YYYY-MM-DD format. Required."),
        confirm_extended_expiry: z
          .boolean()
          .optional()
          .describe("Set to true to confirm an expiry date more than 1 year away"),
        severity: z
          .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"])
          .describe("Severity label of the CVE at the time of acceptance (snapshot). Use UNKNOWN if severity is unavailable."),
        cvss_score: z
          .number()
          .optional()
          .describe("CVSS score of the CVE at the time of acceptance (snapshot)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ cve_id, reason, expires_on, confirm_extended_expiry, severity, cvss_score }) => {
      const result = await acceptRisk(
        repoPath, cve_id, reason, expires_on, confirm_extended_expiry,
        severity as Severity, cvss_score
      );
      const lines = [result.message];
      if (result.guidanceMessage) lines.push(`\n💡 ${result.guidanceMessage}`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // remove_accepted_risk
  server.registerTool(
    "remove_accepted_risk",
    {
      title: "Remove Accepted Risk",
      description: "Remove a previously accepted risk by its UUID acceptance ID.",
      inputSchema: {
        acceptance_id: z
          .string()
          .uuid()
          .describe("The UUID of the accepted risk to remove (from list_accepted_risks)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ acceptance_id }) => {
      const result = await removeAcceptedRisk(repoPath, acceptance_id);
      return { content: [{ type: "text", text: result.message }] };
    }
  );
}
