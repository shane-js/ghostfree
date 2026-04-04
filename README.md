<p align="center">
  <img src="https://raw.githubusercontent.com/shane-js/ghostfree/main/logo.png" alt="GhostFree logo" width="400" />
</p>

# What is GhostFree 🚫👻?
Every software team could use some help ridding their code base of the ghosts haunting their dependencies.

GhostFree is a local MCP server that scans your repository's dependencies for known vulnerabilities based on issued CVEs using [OSV.dev](https://osv.dev), helps you triage and fix findings with NVD and CISA KEV enrichment, and lets you manage accepted risks — all directly from your AI coding assistant.

## Quick Start

No installation, signup, or payment required. Add GhostFree to your MCP settings for whatever code tool you use and run `/ghostfree.scan`.

### VS Code Copilot (Extension — easiest)

Search `@mcp ghostfree` in the Extensions view (`Ctrl+Shift+X`) and click **Install**. Then open the Command Palette (`Ctrl+Shift+P`), run **MCP: List Servers**, select **GhostFree**, choose **Start Server**, and confirm trust when prompted. No JSON config needed.

### VS Code Copilot (Manual config)

Create or update `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "ghostfree": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ghostfree", "--repo-path", "${workspaceFolder}"],
      "env": {}
    }
  }
}
```

### Claude Code

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ghostfree": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ghostfree", "--repo-path", "."]
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ghostfree": {
      "command": "npx",
      "args": ["-y", "ghostfree", "--repo-path", "."]
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json` (location varies by OS):

```json
{
  "mcpServers": {
    "ghostfree": {
      "command": "npx",
      "args": ["-y", "ghostfree", "--repo-path", "/path/to/your/repo"]
    }
  }
}
```

---

## How to Use

### The `/ghostfree.scan` Prompt

The recommended way to run a scan is via the built-in prompt. In your AI client, type:

```
/ghostfree.scan
```

This drives the following flow:

1. **Discover** — finds all manifest files (requirements.txt, package.json, go.mod, Cargo.toml, pom.xml, *.csproj, etc.)
2. **Threshold** — asks you for a minimum severity level (CRITICAL / HIGH / MEDIUM / LOW) if not already configured
3. **Scan** — queries OSV.dev for CVEs across all discovered packages
4. **Triage** — presents numbered results, 10 at a time. You pick which ones to investigate.
5. **Enrich** — fetches CVSS vectors, CWE classification, and CISA KEV "actively exploited" status for your selections
6. **Remediate** — recommends upgrades, code changes, or risk acceptance with a reason and expiry date

### Example Session

```
User: /ghostfree.scan

GhostFree: Discovering dependencies...
Found 84 packages across 2 ecosystems (npm, PyPI).

What minimum severity should I surface? (CRITICAL / HIGH / MEDIUM / LOW)

User: HIGH

GhostFree: Scanning against OSV.dev...

[1] CVE-2021-44228 CRITICAL (10.0) — org.apache.logging.log4j:log4j-core@2.14.1
    Log4Shell: Remote code execution via JNDI lookup
    Fix: upgrade to 2.17.1

[2] CVE-2022-25881 HIGH (7.5) — http-cache-semantics@4.1.0
    ReDoS in http-cache-semantics
    Fix: upgrade to 4.1.1

[3] CVE-2021-28918 CRITICAL (9.8) — netmask@1.0.6
    IP address parsing bypass (SSRF / allowlist bypass)
    Fix: upgrade to 1.1.0

Showing 1-3 of 3. Which would you like to investigate? (e.g., 1, 2, or 'all')

User: 3

GhostFree: [Calls enrich_cve CVE-2021-28918]

CVE-2021-28918 — netmask CRITICAL (9.8)
CVSS: 9.1 · CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
CWE: CWE-704 (Incorrect Type Conversion)
CISA KEV: Not listed

What it is: netmask@1.0.6 improperly parses octal-notation IP addresses (e.g. 010.0.0.1),
treating them as decimal. This enables SSRF protection bypass and IP allowlist/blocklist
bypass — an attacker can craft an address that appears private but routes to a public host.

Exploit status: Not in CISA KEV. Public PoC exists (SICK-2021-011), ~280k affected projects.

Codebase exposure: netmask is not directly imported — it appears in package-lock.json as a
transitive dependency of pac-resolver@3.0.0 (a transitive dev dependency). No direct
require('netmask') or IP parsing logic found. Reachability is very low.

Recommendation: Upgrade — low effort, patch version (1.0.6 → 1.1.0), no API changes.
netmask is a transitive dependency; use npm audit fix or add a package.json overrides entry
to force netmask@1.1.0.

→ Reply with a number to investigate another CVE, 'back' to return to the list,
  'fix' to apply the recommended fix, 'accept' to record an accepted risk, or 'done' to wrap up.
```

### Example: Accepting a Known Risk

```
User: Accept CVE-2022-25881 — it's only in our CI test pipeline, not reachable in production. Expiry end of year.

GhostFree: [Calls accept_risk CVE-2022-25881]

Accepted risk recorded:
• CVE-2022-25881 — http-cache-semantics (HIGH, CVSS 7.5)
  Reason: Only used in CI test pipeline, not reachable in production
  Expires: 2026-12-31
  ID: 550e8400-e29b-41d4-a716-446655440000

This acceptance is saved to .ghostfree/accepted.yml. Commit this file to share the
decision with your team. The CVE will be suppressed on future scans until expiry.

User: List all accepted risks

GhostFree: [Calls list_accepted_risks]

## Accepted Risks (1)

**CVE-2022-25881** — ✅ expires in 272 days (2026-12-31) | Severity at acceptance: HIGH (7.5)
  ID: 550e8400-e29b-41d4-a716-446655440000
  Reason: Only used in CI test pipeline, not reachable in production
  Accepted: 2026-04-03T10:00:00.000Z
```

### Example: Enriching a Specific CVE

```
User: Tell me everything about CVE-2021-44228

GhostFree: [Calls enrich_cve CVE-2021-44228]

## Enrichment: CVE-2021-44228

### NVD
CVSS Score: 10.0 · CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
CWE: CWE-917 (Improper Neutralization of Special Elements in an Expression Language Statement)

References:
• https://nvd.nist.gov/vuln/detail/CVE-2021-44228
• https://logging.apache.org/log4j/2.x/security.html

### CISA KEV
⚠️ CONFIRMED actively exploited in the wild (added to KEV: 2021-12-10)
```

---

## Tools Reference

| Tool | Read-only | Description |
|------|-----------|-------------|
| `discover_dependencies` | ✅ | Scan repo manifests, return all pinned packages by ecosystem |
| `check_cves` | ✅ | Query OSV.dev for CVEs, filter by severity, apply accepted risks |
| `enrich_cve` | ✅ | Fetch CVSS, CWE, references from NVD + KEV exploitation status |
| `list_accepted_risks` | ✅ | List all accepted risks with expiry status and severity snapshot |
| `accept_risk` | ❌ | Record an accepted risk with reason, expiry date, and severity snapshot |
| `remove_accepted_risk` | ❌ | Remove an accepted risk by UUID |

All read-only tools are safe to auto-approve in your MCP client. Write tools (`accept_risk`, `remove_accepted_risk`) will prompt for confirmation.

### `check_cves` Inputs

| Parameter | Required | Description |
|-----------|----------|-------------|
| `packages` | Yes | Array of `{name, version, ecosystem}` — use `discover_dependencies` output |
| `min_severity` | No | `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`. Defaults to `GHOSTFREE_MIN_SEVERITY` env var, then `MEDIUM` |

### `accept_risk` Inputs

| Parameter | Required | Description |
|-----------|----------|-------------|
| `cve_id` | Yes | CVE ID, e.g. `CVE-2021-44228` |
| `reason` | Yes | Business justification |
| `expires_on` | Yes | Expiry date in `YYYY-MM-DD` format |
| `confirm_extended_expiry` | No | Set `true` if expiry is more than 1 year away |
| `severity` | Yes | Severity label at time of acceptance (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`) — snapshot, not live |
| `cvss_score` | No | CVSS score at time of acceptance — snapshot, not live |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GHOSTFREE_MIN_SEVERITY` | Default severity threshold: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| `GHOSTFREE_ACCEPTED_PATH` | Custom path for `accepted.yml` (e.g., `./security/accepted.yml`) |
| `NVD_API_KEY` | Optional NVD API key for higher rate limits (50 req/30s vs 5 req/30s) |

Add these to the `"env"` section of your MCP client config, or set them in your shell environment.

---

## Accepted Risk Management

When you accept a risk, GhostFree writes it to `.ghostfree/accepted.yml` in your repo root. **Commit this file** to share accepted decisions with your team.

```yaml
accepted_risks:
  - id: 550e8400-e29b-41d4-a716-446655440000
    cve_id: CVE-2022-25881
    reason: Only used in CI test pipeline, not reachable in production
    expires_on: "2027-01-01"
    accepted_at: "2026-04-02T10:00:00.000Z"
    severity_at_acceptance: HIGH
    cvss_score_at_acceptance: 7.5
```

Rules:
- `expires_on` is **required** — no open-ended acceptances
- Expiry within 1 year: accepted immediately
- Expiry beyond 1 year: requires `confirm_extended_expiry=true`
- Expired acceptances are **never silently dropped** — they resurface as warnings on every scan

To use a custom path (e.g., a shared `security/` directory), set `GHOSTFREE_ACCEPTED_PATH=./security/accepted.yml`.

---

## Supported Ecosystems & Manifests

| Ecosystem | Manifest Files |
|-----------|---------------|
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile.lock`, `setup.cfg` |
| Node.js | `package.json`, `package-lock.json` |
| Go | `go.mod`, `go.sum` |
| Rust | `Cargo.toml`, `Cargo.lock` |
| Java | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| .NET | `*.csproj`, `packages.config` |

### Version range handling

When a manifest specifies a version range rather than an exact version, GhostFree extracts a single version to query vulnerability databases. We use two taxonomies to keep the reasoning clear: **VRC** (what a specifier *means*) and **VRHP** (what we *do* about it).

#### Version Range Concepts (VRC)

A VRC is an ecosystem-agnostic label for what a version specifier expresses. Multiple VRCs can apply to the same entry (e.g. a caret range *with* a prerelease tag is `vrc-caret + vrc-prerelease`).

| VRC | Concept | Ecosystem examples |
|---|---|---|
| `vrc-exact` | Exact pinned version | npm `1.4.0`, Python `==2.28.0`, Cargo `1.0.188`, Maven `6.0.11` |
| `vrc-lockfile-pin` | Resolved version from lock file | `package-lock.json`, `Cargo.lock`, `go.sum`, `Pipfile.lock` |
| `vrc-prerelease` | Prerelease / pre-stable tag | `1.0.0-beta`, `9.0.0-preview.1`, `1.0.0-SNAPSHOT`, `32.1.2-jre` |
| `vrc-caret` | Caret (major-compatible) range | npm `^1.2.3`, Cargo `^1.0.100`, Poetry `^2.28.0` |
| `vrc-tilde` | Tilde (minor/patch-compatible) range | npm `~4.17.0`, Cargo `~1.0.0`, Poetry `~2.28.0` |
| `vrc-inclusive-minimum` | Inclusive lower bound (`>=`) | npm `>=1.2.0`, Python `>=2.28.0`, Cargo `>=0.5` |
| `vrc-exclusive-minimum` | Exclusive lower bound (`>`) | npm `>1.0.0`, Python `>2.0`, Cargo `>0.5` |
| `vrc-compatible-release` | Compatible release | Python `~=2.28` |
| `vrc-compound` | Multiple constraints combined | npm `>=1.0.0 <2.0.0`, Cargo `>=0.5, <1.0`, Python `>=2.28,<3.0` |
| `vrc-inclusive-range` | Bracket interval with inclusive lower | NuGet `[1.0,2.0)`, Maven `[1.0,2.0]` |
| `vrc-exclusive-range` | Bracket interval with exclusive lower | NuGet `(4.1.3,)`, Maven `(1.0,2.0)` |
| `vrc-wildcard` | Wildcard / any version | npm `*`, NuGet `6.*`, Cargo `*` |
| `vrc-upper-bound-only` | Upper bound with no lower bound | npm `<2.0.0`, Python `<=3.0`, NuGet `[,1.0]`, `(,1.0)` |
| `vrc-exclusion` | Version exclusion | Python `!=2.0` |
| `vrc-tag` | Named tag or alias | npm `latest` |
| `vrc-workspace-ref` | Workspace / path reference | npm `workspace:*`, Cargo `{ workspace = true }` |
| `vrc-property-placeholder` | Build variable placeholder | Maven `${spring.version}` |
| `vrc-build-metadata` | Build metadata suffix | Go `v1.0.0+build.123` |
| `vrc-pseudo-version` | Go pseudo-version | Go `v0.0.0-20230817171753-abc123` |

#### Version Range Handling Principles (VRHP)

A VRHP is the action GhostFree takes once a VRC is identified. String-keyed so ordering never matters.

| VRHP | Action | Detail |
|---|---|---|
| `vrhp-lockfile` | **Use lock file version** | If a resolved lock file exists (`package-lock.json`, `Cargo.lock`, `go.sum`, `Pipfile.lock`), use its exact installed version. No interpretation needed. |
| `vrhp-extract-lower` | **Extract the lower bound** | For range specifiers (`^`, `~`, `>=`), extract the minimum version the developer has accepted. This is the oldest — and most-likely-vulnerable — version they could be running. |
| `vrhp-skip` | **Skip dependency** | If a specifier provides only an upper bound (`<=`, `<`), an exclusion (`!=`), is unresolvable (`*`, `latest`, `workspace:*`), or uses a notation only a resolver can evaluate, skip the dependency. Querying a wrong version produces false positives or false negatives — both worse than a coverage gap you can fix by pinning or providing a lock file. |
| `vrhp-preserve-prerelease` | **Preserve prerelease tag** | Versions like `1.0.0-beta.1`, `2.0.0-rc`, and `32.1.2-jre` are queried as-is. Prerelease versions can have their own CVEs and must not be stripped or normalized. When `vrc-prerelease` co-occurs with another VRC, this principle always applies alongside the primary VRHP. |
| `vrhp-passthrough` | **Pass through verbatim** | Go `go.mod`, .NET `packages.config`, and all lock files use exact pinned versions with no range operators. Non-version strings (e.g. `${...}` property placeholders in Maven) are skipped. |

#### Ecosystem examples

| Ecosystem / File | Example input | Queried version | VRC | VRHP |
|---|---|---|---|---|
| **.NET** `*.csproj` — exact version | `2.28.2` | `2.28.2` | `vrc-exact` | `vrhp-passthrough` |
| **.NET** `*.csproj` — prerelease | `1.0.0-beta`, `9.0.0-preview.1` | `1.0.0-beta`, `9.0.0-preview.1` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **.NET** `*.csproj` — inclusive interval `[lower,upper)` | `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` |
| **.NET** `*.csproj` — wildcard `6.*`, `6.0.*` | `6.*`, `6.0.*` | `6.0`, `6.0.0` | `vrc-wildcard` | `vrhp-extract-lower` — `.*` replaced with `.0` |
| **.NET** `*.csproj` — exclusive lower / upper-only | `(4.1.3,)`, `[,1.0]`, `(,1.0)` | *(omitted)* | `vrc-exclusive-range`, `vrc-upper-bound-only` | `vrhp-skip` |
| **.NET** `packages.config` — exact version | `13.0.3` | `13.0.3` | `vrc-exact` | `vrhp-passthrough` |
| **.NET** `packages.config` — prerelease | `5.0.0-beta.1` | `5.0.0-beta.1` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **Go** `go.mod` — exact version | `v1.21.0` | `1.21.0` | `vrc-exact` | `vrhp-passthrough` — `v` prefix stripped |
| **Go** `go.mod` — prerelease / build metadata | `v1.0.0-beta.1`, `v2.0.0+build.123` | `1.0.0-beta.1`, `2.0.0+build.123` | `vrc-prerelease`, `vrc-build-metadata` | `vrhp-passthrough` — `v` stripped; tags preserved |
| **Go** `go.sum` — exact version | `v1.21.0` | `1.21.0` | `vrc-lockfile-pin` | `vrhp-lockfile` — `v` stripped; `/go.mod` lines deduplicated |
| **Go** `go.sum` — prerelease | `v1.0.0-rc.1` | `1.0.0-rc.1` | `vrc-lockfile-pin` + `vrc-prerelease` | `vrhp-lockfile` — `v` stripped |
| **Java** `build.gradle` / `build.gradle.kts` — exact version | `2.28.2` | `2.28.2` | `vrc-exact` | `vrhp-passthrough` |
| **Java** `build.gradle` / `build.gradle.kts` — prerelease / SNAPSHOT / classifier | `1.0.0-SNAPSHOT`, `32.1.2-jre` | `1.0.0-SNAPSHOT`, `32.1.2-jre` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **Java** `build.gradle` / `build.gradle.kts` — inclusive interval | `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` |
| **Java** `build.gradle` / `build.gradle.kts` — exclusive lower / upper-only | `(4.1.3,)`, `[,1.0]` | *(omitted)* | `vrc-exclusive-range`, `vrc-upper-bound-only` | `vrhp-skip` |
| **Java** `pom.xml` — exact version | `2.28.2` | `2.28.2` | `vrc-exact` | `vrhp-passthrough` |
| **Java** `pom.xml` — prerelease / SNAPSHOT / classifier | `1.0.0-SNAPSHOT`, `32.1.2-jre` | `1.0.0-SNAPSHOT`, `32.1.2-jre` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **Java** `pom.xml` — inclusive interval | `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` |
| **Java** `pom.xml` — exclusive lower / upper-only / placeholder | `(4.1.3,)`, `[,1.0]`, `${spring.version}` | *(omitted)* | `vrc-exclusive-range`, `vrc-upper-bound-only`, `vrc-property-placeholder` | `vrhp-skip` |
| **npm** `package.json` — exact version | `1.4.0` | `1.4.0` | `vrc-exact` | `vrhp-passthrough` |
| **npm** `package.json` — prerelease | `1.0.0-beta.1`, `^1.0.0-rc.2` | `1.0.0-beta.1`, `1.0.0-rc.2` | `vrc-prerelease`, `vrc-caret` + `vrc-prerelease` | `vrhp-preserve-prerelease`, `vrhp-extract-lower` |
| **npm** `package.json` — `^`, `~`, `>=`, `>`, `=` | `^1.2.3`, `>=1.2.0 <2.0.0` | `1.2.3`, `1.2.0` | `vrc-caret`, `vrc-compound` | `vrhp-extract-lower` |
| **npm** `package.json` — `*`, `latest`, `workspace:*`, `<` | `*`, `latest`, `<2.0.0` | *(omitted)* | `vrc-wildcard`, `vrc-tag`, `vrc-workspace-ref`, `vrc-upper-bound-only` | `vrhp-skip` |
| **npm** `package-lock.json` | `1.2.3` | `1.2.3` | `vrc-lockfile-pin` | `vrhp-lockfile` |
| **Python** `Pipfile.lock` | `2.28.2` | `2.28.2` | `vrc-lockfile-pin` | `vrhp-lockfile` |
| **Python** `pyproject.toml` (PEP 621) — `==` / `>=` / `~=` | `httpx==0.24.0`, `pydantic>=2.0.0` | `0.24.0`, `2.0.0` | `vrc-exact`, `vrc-inclusive-minimum` | `vrhp-passthrough`, `vrhp-extract-lower` |
| **Python** `pyproject.toml` (Poetry) — `^`, `~`, `>=` | `^2.28.0`, `>=2.28,<3.0` | `2.28.0`, `2.28` | `vrc-caret`, `vrc-compound` | `vrhp-extract-lower` |
| **Python** `pyproject.toml` (Poetry) — prerelease | `^1.0.0-beta` | `1.0.0-beta` | `vrc-caret` + `vrc-prerelease` | `vrhp-extract-lower` |
| **Python** `pyproject.toml` (Poetry) — `!=`, `<` only | `!=2.28.0`, `<3.0` | *(omitted)* | `vrc-exclusion`, `vrc-upper-bound-only` | `vrhp-skip` |
| **Python** `requirements.txt`, `setup.cfg` — `==` / `===` / `>=` / `>` / `~=` | `requests>=2.28.0`, `requests~=2.28`, `requests===2.0.0` | `2.28.0`, `2.28`, `2.0.0` | `vrc-inclusive-minimum`, `vrc-compatible-release`, `vrc-exact` | `vrhp-extract-lower`, `vrhp-passthrough` |
| **Python** `requirements.txt`, `setup.cfg` — prerelease | `requests==1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **Python** `requirements.txt`, `setup.cfg` — `<=` / `<` / `!=` only | `requests<=2.28.0` | *(omitted)* | `vrc-upper-bound-only`, `vrc-exclusion` | `vrhp-skip` |
| **Rust** `Cargo.toml` — bare version (implicit `^`) | `1.0.188` | `1.0.188` | `vrc-exact` | `vrhp-passthrough` |
| **Rust** `Cargo.toml` — prerelease | `1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` |
| **Rust** `Cargo.toml` — `^`, `~`, `>=`, `>`, `=` | `^1.0`, `>=0.5` | `1.0`, `0.5` | `vrc-caret`, `vrc-inclusive-minimum` | `vrhp-extract-lower` |
| **Rust** `Cargo.toml` — `*`, `<` | `*`, `<1.0` | *(omitted)* | `vrc-wildcard`, `vrc-upper-bound-only` | `vrhp-skip` |
| **Rust** `Cargo.lock` | `1.0.86` | `1.0.86` | `vrc-lockfile-pin` | `vrhp-lockfile` |


---

## FAQ

**Q: Why would I need something more than my current AI coding agent(s)?**  
Your AI agent's knowledge of vulnerabilities is frozen at its training cutoff. New CVEs are disclosed daily — example: Log4Shell, for example, was disclosed in December 2021 and would be invisible to any model trained before that.

GhostFree queries live authoritative vulnerability reporting organizations for up to date information, so every scan reflects the current threat landscape regardless of when your model was trained. This extra context is also critical in increasing the accuracy or whatever suggestions or recommendations your agent can provide.

It also tracks your accepted risks with reasons and expiry dates, building an auditable record that lives in your repo. 

It aims to do all of this with as much determinism as can be introduced while still at its coring being run by your chosen agent that interacts with GhostFree. While running it with the best model you can afford is our recommendation, this determinism strategy helps cheaper/weaker models be decently effective vulnerability remediationa assistants when aided with GhostFree from our testing.

**Q: Does GhostFree upload my code anywhere?**  
No. Only package names and versions are sent to OSV.dev. No source code leaves your machine.

**Q: Do I need an API key?**  
No. OSV.dev requires no auth. NVD enrichment works without a key (rate-limited to 5 req/30s) which you are unlikely to hit in typical human use of this tool (you would start to see if running in some autonomous agent setup though). Set env variable `NVD_API_KEY` for higher limits (see [nist.gov](https://nvd.nist.gov/developers/request-an-api-key) website for more details).

**Q: What if I'm offline?**  
The scan requires OSV.dev access. NVD and KEV enrichment will gracefully degrade with a warning if unreachable.

**Q: Does it scan transitive dependencies?**  
Partially. When a lock file is present, GhostFree scans the full resolved dependency graph (direct + transitive): `package-lock.json` for Node.js, `Cargo.lock` for Rust, `go.sum` for Go, and `Pipfile.lock` for Python. For ecosystems without lock file support (Java, .NET), only directly declared dependencies are scanned.

**Q: The scan found a CVE I've already fixed. What do I do?**  
Update the package version in your manifest. On the next scan it will no longer appear.

---

## Support

For bugs and feature requests, open an issue on GitHub.

---

## Privacy Policy

GhostFree processes your repository's dependency manifests locally on your machine. Here is exactly what data leaves your machine and where it goes:

| Data sent | Destination | Purpose |
|-----------|-------------|---------|
| Package names and versions | [OSV.dev](https://osv.dev) (Google) | CVE lookup |
| CVE ID | [NVD API](https://nvd.nist.gov) (NIST/U.S. Gov) | CVSS score and CWE enrichment |
| CVE ID | [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) (U.S. Gov) | Known exploitation status |

**No source code, file contents, repository names, user identifiers, or telemetry data of any kind are ever coded to be sent anywhere by us.** As when interacting with any AI assisted tools, your underlying environment, AI model, agent, IDE, etc. are beyond our control in how it chooses to interact with our code and your code. Anyone making use of this tool should familiarize themselves with the information in our included `LICENSE.txt` (MIT).

GhostFree does not collect, store, or share any data. All processing happens locally. The accepted risks file (`.ghostfree/accepted.yml`) stays in your repository under your control.

For questions, open an issue on GitHub.

---

## Acknowledgements

GhostFree is built entirely on the shoulders of three organizations that have made their vulnerability intelligence freely available to the world and all the vulnerability researchers around the world that report CVEs. Without them, this tool would not exist.

**Google Open Source Security Team — Open Source Vulnerabilities (OSV)**  
OSV.dev is the backbone of every GhostFree scan. It provides a free, open API for querying known vulnerabilities across all major package ecosystems by package name and version, and includes severity scores and fix version data in a single response. Its generous rate limits and zero-auth design make it ideal for a tool that runs locally on every developer's machine.

**U.S. National Institute of Standards and Technology — National Vulnerability Database (NVD)**  
The National Vulnerability Database, maintained by NIST within the U.S. Department of Commerce, is the authoritative source for standardised CVSS severity vectors and CWE classification for every published CVE. GhostFree calls the NVD API 2.0 during per-CVE triage to surface the full technical detail a developer needs to make an informed remediation decision.

**U.S. Cybersecurity and Infrastructure Security Agency — Known Exploited Vulnerabilities (KEV)**  
CISA, part of the U.S. Department of Homeland Security, publishes and maintains the Known Exploited Vulnerabilities catalog — a curated list of CVEs confirmed to be actively exploited in the wild. GhostFree downloads and uses this catalog to answer the one question that most changes how urgently a team should act: *Is this being exploited right now?*

---

Our goal is to make the security intelligence these organizations produce — gathered at significant public expense and shared freely in the interest of a safer internet — as accessible as possible to every developer, wherever they work. The bad actors chasing these vulnerabilities don't sleep. Neither does the data.
