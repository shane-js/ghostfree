import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SCAN_PROMPT_TEXT = `
You are running a GhostFree security scan. Follow these steps in order:

**Step 1 — Discover dependencies**
In large font size display "🚫👻 GhostFree scan starting..." and then immediately call the \`discover_dependencies\` tool. It will return all pinned packages found in manifest files across the repository.

**Step 2 — Check for CVEs**
Call \`check_cves\` **without** a \`min_severity\` argument and **without** a \`packages\` argument. The tool will determine the severity threshold automatically using internal logic and will confirm the source it used to determine it in its response.

**Step 3 — Present results (paginated)**
The tool will return a numbered list of actionable CVEs. Present the first 10 to the user in this format:
  [1] CVE-XXXX-YYYY CRITICAL (9.8) — package-name: brief description

If there are more than 10 results, add: "Showing 1-10 of N. Say 'next' to see 11-20."
If the user says 'next', present the next page (continuing the sequential numbering). Keep track of the current page offset.

**Previously accepted risks** — Before showing the numbered CVE list, call \`list_accepted_risks\` to check for existing acceptances.
- Always show expired acceptances first with ⚠️.
- Then show up to **3** non-expired acceptances, sorted by soonest expiry date first. Include the severity snapshot if available, e.g.: "✅ CVE-XXXX CRITICAL (9.8) — suppressed until YYYY-MM-DD".
- If there are more than 3 non-expired acceptances, add: "…and N more. Say **'accepted'** to see all, or view your \`accepted.yml\` file directly."
- If there are zero accepted risks, confirm: "ℹ️ No previously accepted risks found."

Surface expired acceptances immediately — do not wait for the user to ask. Use three "❗" emojis to indicate urgency for expired acceptances.

**Step 4 — Triage selection**
Ask the user: "Which CVEs would you like to investigate? Reply with the numbers (e.g., 1, 3, 7) or 'all'."

**Step 5 — Enrich and assess**
For each selected CVE:
1. Call \`enrich_cve\` to get CVSS vectors, CWE classification, and CISA KEV status.
2. Search the repository source code for usage of the affected package to assess actual exposure.
3. Summarize: severity, exploit status (KEV), how the package is used, and whether the vulnerability is reachable.

**Step 6 — Recommend remediation**
For each CVE, recommend one of:
- **Upgrade**: Provide the exact version to upgrade to and the relevant manifest file to edit. Before committing to full analysis, give a rough effort signal describing the semver distance and expected impact, e.g. "Effort: Low — patch upgrade (x.y.3 → x.y.9), no API changes expected" or "Effort: Medium — minor upgrade (2.1.x → 2.2.x), check changelog for any deprecations" or "Effort: High — major upgrade (1.x → 2.x), expect breaking changes". Be specific and concise when describing the size of a version bump.
- **Code change**: Describe the specific code pattern to avoid or replace. Provide a similar effort signal.
- **Accept risk**: If the CVE is not reachable or the risk is acceptable, suggest calling \`accept_risk\` with a reason and expiry date. **Always include \`severity\` and \`cvss_score\`** from the enrichment data so the acceptance records the severity snapshot at the time of acceptance.

After presenting each recommendation, always show these options before moving on:
  \u2192 Reply with a number to investigate another CVE, **'back'** to return to the previous CVE list, **'fix'** to apply the recommended fix now, **'accept'** to accept the risk for this CVE, or **'done'** to wrap up.
  If the user replies 'fix', apply the change (edit the manifest file) and confirm what was changed.

After a risk is accepted via \`accept_risk\`, confirm with "✅ Risk Accepted" and then **return to the CVE list at the same page position the user was viewing**, marking the accepted CVE with "✅ Risk Accepted" next to it. Do not restart the list from page 1.

After all selected CVEs are addressed, ask: "Are there more CVEs you'd like to investigate, or shall we wrap up?"
`.trim();

export function registerScanPrompt(server: McpServer): void {
  server.registerPrompt(
    "scan",
    {
      title: "GhostFree Security Scan",
      description:
        "Run a full dependency vulnerability scan: discover packages, check OSV.dev for CVEs, triage with NVD/KEV enrichment, and get remediation guidance.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: SCAN_PROMPT_TEXT },
        },
      ],
    })
  );
}
