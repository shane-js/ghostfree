<p align="center">
  <img src="https://raw.githubusercontent.com/shane-js/ghostfree/main/logo.png" alt="GhostFree logo" width="400" />
</p>

# GhostFree — Dependency Vulnerability Scanner

Every software team could use some help ridding their codebase of the ghosts haunting their dependencies.

This extension registers GhostFree as an MCP server in VS Code, making it available to GitHub Copilot and other AI assistants automatically — no manual JSON configuration required.

GhostFree scans your repository's dependencies for known vulnerabilities based on issued CVEs using [OSV.dev](https://osv.dev), helps you triage and fix findings with NVD and CISA KEV enrichment, and lets you manage accepted risks — all directly from your AI coding assistant.

## Quick Start

1. Install this extension
2. Open the Command Palette (`Ctrl+Shift+P`) and run **MCP: List Servers**
3. Select **GhostFree** from the list, then choose **Start Server** and confirm trust when prompted
4. Open a workspace with dependencies
5. In Copilot Chat, type `/ghostfree.scan`

No signup, no API key, no configuration needed.

## How It Works

Type `/ghostfree.scan` in GitHub Copilot Chat to kick off the full workflow:

1. **Discover** — finds all manifest files (`requirements.txt`, `package.json`, `go.mod`, `Cargo.toml`, `pom.xml`, `*.csproj`, etc.)
2. **Threshold** — asks for a minimum severity level (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`)
3. **Scan** — queries OSV.dev for CVEs across all discovered packages
4. **Triage** — presents numbered results, 10 at a time
5. **Enrich** — fetches CVSS vectors, CWE classification, and CISA KEV "actively exploited" status
6. **Remediate** — recommends upgrades, code changes, or risk acceptance

## Example Session

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

Showing 1-2 of 2. Which would you like to investigate? (e.g., 1, 2, or 'all')
```

## Tools Reference

| Tool | Read-only | Description |
|------|-----------|-------------|
| `discover_dependencies` | ✅ | Scan repo manifests, return all pinned packages by ecosystem |
| `check_cves` | ✅ | Query OSV.dev for CVEs, filter by severity, apply accepted risks |
| `enrich_cve` | ✅ | Fetch CVSS, CWE, references from NVD + KEV exploitation status |
| `list_accepted_risks` | ✅ | List all accepted risks with expiry status and severity snapshot |
| `accept_risk` | ❌ | Record an accepted risk with reason, expiry date, and severity snapshot |
| `remove_accepted_risk` | ❌ | Remove an accepted risk by UUID |

All read-only tools are safe to auto-approve. Write tools (`accept_risk`, `remove_accepted_risk`) will prompt for confirmation.

## Accepted Risk Management

When you accept a risk, GhostFree writes it to `.ghostfree/accepted.yml` in your repo. Commit this file to share accepted decisions with your team.

- `expires_on` is **required** — no open-ended acceptances
- Expiry beyond 1 year requires `confirm_extended_expiry=true`
- Expired acceptances resurface as warnings on every scan — never silently dropped

## Supported Ecosystems

| Ecosystem | Manifest Files |
|-----------|---------------|
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile.lock`, `setup.cfg` |
| Node.js | `package.json`, `package-lock.json` |
| Go | `go.mod`, `go.sum` |
| Rust | `Cargo.toml`, `Cargo.lock` |
| Java | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| .NET | `*.csproj`, `packages.config` |

Lock files (`package-lock.json`, `Cargo.lock`, `go.sum`, `Pipfile.lock`) are used when present, giving full transitive dependency coverage.

## Environment Variables

Set these in your shell or in the VS Code MCP server `env` config:

| Variable | Description |
|----------|-------------|
| `GHOSTFREE_MIN_SEVERITY` | Default severity threshold: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` |
| `GHOSTFREE_ACCEPTED_PATH` | Custom path for `accepted.yml` |
| `NVD_API_KEY` | Optional — raises NVD rate limit from 5 to 50 req/30s |

## Privacy

Only package names and versions are sent to OSV.dev. CVE IDs are sent to NVD and CISA KEV for enrichment. **No source code, file contents, or user identifiers ever leave your machine.**

## FAQ

**Q: Does GhostFree upload my code?**
No. Only package names, versions, and CVE IDs are sent to external APIs.

**Q: Do I need an API key?**
No. Everything works without keys. An `NVD_API_KEY` is optional for higher rate limits.

**Q: Does it scan transitive dependencies?**
Yes, when a lock file is present. Without a lock file, only directly declared dependencies are scanned.

**Q: Why not just use my AI's built-in knowledge?**
Your AI's vulnerability knowledge is frozen at its training cutoff. GhostFree queries live databases on every scan, so it reflects the current threat landscape regardless of model age.

## Links

- [GitHub Repository](https://github.com/shane-js/ghostfree)
- [Report an Issue](https://github.com/shane-js/ghostfree/issues)
- [npm Package](https://www.npmjs.com/package/ghostfree)
