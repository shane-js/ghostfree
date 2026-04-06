import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryOsv } from "../api/osv.js";
import { listAcceptedRisks } from "../accepted-risks.js";
import { resolveMinSeverity, meetsThreshold, sortBySeverity } from "../severity.js";
import { readConfig } from "../config.js";
import { getCachedDeps } from "../dep-cache.js";
import type { Dependency, Vulnerability, Severity } from "../types.js";
import type { GhostFreeConfig } from "../config.js";

type ValidSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/**
 * Resolves min_severity through the pre-elicit chain:
 *   tool arg → env var → config file
 *
 * Returns undefined if none of the sources provided a value, signalling
 * that the caller should fall through to MCP elicitation.
 *
 * Dependencies are injected so this function can be unit-tested without
 * a real MCP server, file system, or process.env.
 */
export async function resolvePreElicitSeverity(
  toolArg: string | undefined,
  getEnv: (key: string) => string | undefined,
  readConfigFn: () => Promise<GhostFreeConfig>
): Promise<{ severity: ValidSeverity | undefined; source: string }> {
  // 1. Explicit tool argument — highest priority
  if (toolArg) {
    return { severity: toolArg as ValidSeverity, source: "tool argument" };
  }

  // 2. Environment variable — overrides per-repo defaults (CI/CD, local .env)
  const envVal = getEnv("GHOSTFREE_MIN_SEVERITY");
  if (envVal) {
    return { severity: envVal as ValidSeverity, source: "environment variable (GHOSTFREE_MIN_SEVERITY)" };
  }

  // 3. Config file — team default committed to source control
  const config = await readConfigFn();
  if (config.min_severity && config.min_severity !== "UNKNOWN") {
    return { severity: config.min_severity as ValidSeverity, source: "config file (.ghostfree/config.yml)" };
  }

  return { severity: undefined, source: "" };
}

const PackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  ecosystem: z.string(),
});

export function registerCheckCvesTool(server: McpServer, repoPath: string): void {
  server.registerTool(
    "check_cves",
    {
      title: "Check CVEs",
      description:
        "Check a list of packages against OSV.dev for known vulnerabilities. Returns CVEs above the severity threshold as a numbered list, suppressed/accepted risks, expired acceptances, and a count of below-threshold findings.",
      inputSchema: {
        packages: z
          .array(PackageSchema)
          .optional()
          .default([])
          .describe("Array of packages to check. If omitted, uses packages from the last discover_dependencies call."),
        min_severity: z
          .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
          .optional()
          .describe(
            "Minimum severity to surface in detail: CRITICAL, HIGH, MEDIUM, or LOW. If omitted, GhostFree will determine the threshold automatically."
          ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ packages, min_severity }) => {
      // Resolution order: tool arg → config file → env var → elicit (prompt) and save to config
      let { severity: resolvedMinSeverity, source: severitySource } = await resolvePreElicitSeverity(
        min_severity,
        (key) => process.env[key],
        () => readConfig(repoPath)
      );
      if (!resolvedMinSeverity) {
        try {
          const result = await server.server.elicitInput({
            message: "What minimum severity level should I surface CVEs at?",
            requestedSchema: {
              type: "object",
              properties: {
                severity: {
                  type: "string",
                  title: "Minimum Severity",
                  enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
                  enumNames: ["CRITICAL — only the most severe", "HIGH — serious issues", "MEDIUM — moderate and above (default)", "LOW — everything"],
                  default: "MEDIUM",
                },
              },
              required: ["severity"],
            },
          });
          if (result.action === "accept" && result.content?.["severity"]) {
            resolvedMinSeverity = result.content["severity"] as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
            severitySource = "user selection";
          }
        } catch {
          // Client doesn't support elicitation — fall through to env/default resolution (i.e. chat)
        }
      }

      const deps: Dependency[] =
        packages && packages.length > 0 ? packages : (getCachedDeps() ?? []);

      if (deps.length === 0) {
        return {
          content: [{ type: "text", text: "No packages to check. Run discover_dependencies first." }],
        };
      }

      console.error(`[ghostfree] check_cves: packages arg length=${packages?.length ?? 'none'}, using ${deps.length} deps from ${packages && packages.length > 0 ? 'input' : 'cache'}`);
      const threshold: Severity = resolveMinSeverity(resolvedMinSeverity);
      const acceptedRisks = await listAcceptedRisks(repoPath);

      // Build lookup maps
      const acceptedByCveId = new Map(acceptedRisks.map((r) => [r.cve_id.toUpperCase(), r]));

      const vulns = await queryOsv(deps);

      type ActionableVuln = Vulnerability & { displayNumber: number };
      const actionable: ActionableVuln[] = [];
      const suppressed: Array<{ cveId: string; acceptanceId: string; expiresOn: string }> = [];
      const expired: Array<{ vulnerability: Vulnerability; risk: (typeof acceptedRisks)[0] }> = [];
      let belowThresholdCount = 0;

      const sorted = sortBySeverity(vulns);

      for (const vuln of sorted) {
        const accepted = acceptedByCveId.get(vuln.id.toUpperCase());

        if (accepted) {
          if (accepted.isExpired) {
            expired.push({ vulnerability: vuln, risk: accepted });
          } else {
            suppressed.push({
              cveId: vuln.id,
              acceptanceId: accepted.id,
              expiresOn: accepted.expires_on,
            });
          }
          continue;
        }

        if (!meetsThreshold(vuln.severity, threshold)) {
          belowThresholdCount++;
          continue;
        }

        actionable.push({ ...vuln, displayNumber: actionable.length + 1 });
      }

      // Format output
      const lines: string[] = [];

      lines.push(`## CVE Scan Results (threshold: ${threshold})\n`);
      lines.push(`Packages scanned: ${deps.length}`);
      lines.push(`Total vulnerabilities found: ${vulns.length}`);
      lines.push(`Severity threshold: ${threshold} (source: ${severitySource})\n`);

      if (actionable.length === 0) {
        lines.push("✅ No actionable CVEs found above the severity threshold.\n");
      } else {
        lines.push(`### Actionable CVEs (${actionable.length})\n`);
        for (const v of actionable) {
          const fix =
            v.fixedVersions.length > 0
              ? `Fix: upgrade to ${v.fixedVersions.join(" or ")}`
              : "No fix version available";
          lines.push(
            `[${v.displayNumber}] **${v.id}** ${v.severity}${v.cvssScore !== undefined ? ` (${v.cvssScore})` : ""} — ${v.packageName}@${v.ecosystem}`
          );
          lines.push(`    ${v.summary || "No description available"}`);
          lines.push(`    ${fix}\n`);
        }
      }

      if (expired.length > 0) {
        lines.push(`### ⚠️ Expired Acceptances (${expired.length})\n`);
        for (const { vulnerability: v, risk: r } of expired) {
          lines.push(`  **${v.id}** — acceptance ${r.id} expired on ${r.expires_on}`);
          lines.push(`  Reason: ${r.reason}\n`);
        }
      }

      if (suppressed.length > 0) {
        lines.push(
          `### ✅ Suppressed (${suppressed.length}) — accepted risks, not expired`
        );
        lines.push(suppressed.map((s) => `  ${s.cveId} (expires ${s.expiresOn})`).join("\n"));
        lines.push("");
      }

      if (belowThresholdCount > 0) {
        lines.push(`ℹ️ ${belowThresholdCount} CVE(s) below ${threshold} threshold not shown.`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
