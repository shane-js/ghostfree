# Contributing to GhostFree

This guide is for maintainers and contributors. For end-user setup, see [README.md](README.md).

---

## Project Structure

```
ghostfree/
├── src/
│   ├── index.ts                  # Entry point: server init, tool/prompt registration, CLI args
│   ├── types.ts                  # Shared TypeScript interfaces (Dependency, Vulnerability, etc.)
│   ├── severity.ts               # Severity ordering, threshold filtering, sorting helpers
│   ├── dep-cache.ts              # Session-scoped cache for last discovered Dependency[]
│   ├── accepted-risks.ts         # CRUD for accepted.yml: load, save, accept, remove, list
│   ├── parsers/
│   │   ├── index.ts              # Filesystem walker + parser dispatch (discoverDependencies)
│   │   ├── python/
│   │   │   ├── index.ts          # parseRequirementsTxt, parsePyprojectToml, parsePipfileLock, parseSetupCfg
│   │   │   ├── parseRequirementsTxt.spec.md
│   │   │   ├── parsePyprojectToml.spec.md
│   │   │   ├── parsePipfileLock.spec.md
│   │   │   └── parseSetupCfg.spec.md
│   │   ├── node/
│   │   │   ├── index.ts          # parsePackageJson, parsePackageLockJson
│   │   │   ├── parsePackageJson.spec.md
│   │   │   └── parsePackageLockJson.spec.md
│   │   ├── go/
│   │   │   ├── index.ts          # parseGoMod, parseGoSum
│   │   │   ├── parseGoMod.spec.md
│   │   │   └── parseGoSum.spec.md
│   │   ├── rust/
│   │   │   ├── index.ts          # parseCargoToml, parseCargoLock
│   │   │   ├── parseCargoToml.spec.md
│   │   │   └── parseCargoLock.spec.md
│   │   ├── java/
│   │   │   ├── index.ts          # parsePomXml, parseBuildGradle
│   │   │   ├── parsePomXml.spec.md
│   │   │   └── parseBuildGradle.spec.md
│   │   └── dotnet/
│   │       ├── index.ts          # parseCsproj, parsePackagesConfig
│   │       ├── parseCsproj.spec.md
│   │       └── parsePackagesConfig.spec.md
│   ├── api/
│   │   ├── osv.ts                # OSV.dev batch query (primary scan API)
│   │   ├── nvd.ts                # NVD API 2.0 (per-CVE enrichment, rate-limited)
│   │   └── kev.ts                # CISA KEV catalog (in-memory cache, session-scoped)
│   ├── tools/
│   │   ├── discover.ts           # MCP tool: discover_dependencies
│   │   ├── check-cves.ts         # MCP tool: check_cves
│   │   ├── enrich-cve.ts         # MCP tool: enrich_cve
│   │   └── accepted-risks-tools.ts # MCP tools: list/accept/remove accepted risks
│   └── prompts/
│       └── scan.ts               # MCP prompt: /ghostfree.scan
├── tests/
│   ├── fixtures/                 # Manifest samples for parser unit tests
│   ├── parsers/                  # Parser unit tests (one file per ecosystem)
│   ├── api/                      # API client unit tests (mocked fetch)
│   ├── accepted-risks.test.ts    # Accepted risk CRUD unit tests
│   ├── dep-cache.test.ts         # Dep cache unit tests
│   ├── severity.test.ts          # Severity helper unit tests
│   └── integration/              # Live API integration tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Data Flow

```
User invokes /ghostfree.scan
        │
        ▼
discover_dependencies(repoPath)
  └─ Walk filesystem, match manifests → parsers → Dependency[]
        │
        ▼
check_cves(packages, min_severity)
  └─ queryOsv(deps) → OSV.dev batch API → Vulnerability[]
  └─ Filter against accepted risks (loadAcceptedRisks)
  └─ Apply severity threshold (meetsThreshold)
  └─ Return: actionable list (numbered) + suppressed + expired + below-threshold count
        │
        ▼ (user selects CVEs by number)
enrich_cve(cve_id)
  └─ fetchNvdCve → NVD API 2.0 (CVSS vectors, CWE, references)
  └─ lookupKev → CISA KEV catalog (actively exploited?)
  └─ Both degrade gracefully if unavailable
        │
        ▼
Remediation recommendation
  └─ Upgrade / code change / accept_risk
```

**Key invariant**: OSV.dev is the **only** API in the main scan path. NVD and KEV are only called per-CVE during active triage, never during bulk scanning.

---

## Version Range Taxonomy (VRC and VRHP)

When a manifest specifies a version range instead of an exact version, GhostFree must decide what single version to query. Two taxonomies keep the reasoning explicit across parser code, spec files, fixture comments, and tests.

### VRC — Version Range Concept

A VRC is an **ecosystem-agnostic label** for what a version specifier *means*. Multiple VRCs can apply to a single entry (e.g. `vrc-caret + vrc-prerelease`). See [README.md](README.md) for the full VRC table.

Examples: `vrc-exact`, `vrc-caret`, `vrc-inclusive-range`, `vrc-upper-bound-only`, `vrc-prerelease`, `vrc-lockfile-pin`

### VRHP — Version Range Handling Principle

A VRHP is the **action GhostFree takes** once a VRC is identified. There are five principles:

| VRHP | Action |
|---|---|
| `vrhp-passthrough` | Use the version verbatim (exact pins, lock files) |
| `vrhp-extract-lower` | Extract the lower bound of a range |
| `vrhp-lockfile` | Use the exact resolved version from a lock file |
| `vrhp-preserve-prerelease` | Preserve prerelease tag as-is — always combined with the primary VRHP |
| `vrhp-skip` | Omit the dependency (upper-bound-only, exclusions, unresolvable) |

### Where the taxonomy appears

| Location | Convention |
|---|---|
| `*.spec.md` — range table | `\| VRC \| VRHP \|` columns |
| Source parser comments (`index.ts`) | `// vrc-X → vrhp-Y` inline; JSDoc sections labelled `vrhp-Y:` |
| Fixture file comments | VRC label only (e.g. `// vrc-caret`) — VRHP is implementation detail |
| Test name (`describe`/`it`) | VRC label first: `"vrc-caret — extracts lower bound from ^1.0.0"` |
| Test assertion comment | `// vrc-X → vrhp-Y` on the `expect(...)` line |

---

## Parser Spec Files (`*.spec.md`)

Every parser function has a co-located `<ParseFunctionName>.spec.md` file in its subdirectory. This is the **authoritative source of truth** for that function's version range behaviour — it is read by maintainers and AI assistants alike to understand the intended logic before reading source code.

Each spec file contains:
- A link to the upstream ecosystem versioning docs
- A markdown table with columns: `| Input | Queried Version | VRC | VRHP | Description |`
- Any ecosystem-specific parsing notes (encoding quirks, field names, etc.)

When you modify parsing behaviour, **update the spec file first**, then the source, then the tests.

---

## Adding a New Ecosystem Parser

1. Create a subdirectory `src/parsers/<ecosystem>/` with an `index.ts`. Export one or more functions:
   ```ts
   export function parseXxx(content: string, ...helpers): Dependency[]
   ```
   - Return `{ name, version, ecosystem }` objects
   - Ecosystem name **must match OSV.dev values**: `PyPI`, `npm`, `Go`, `crates.io`, `Maven`, `NuGet`, etc.
   - In source comments, label version handling decisions with their VRHP: `// vrhp-extract-lower`, `// vrhp-skip`, etc.

2. Create a `<ParseFunctionName>.spec.md` file in the same subdirectory for each exported parser function. Use the `| Input | Queried Version | VRC | VRHP | Description |` table format — see any existing spec file for the pattern.

3. Register in `src/parsers/index.ts`:
   - Import your parser functions (the directory import resolves to `index.ts`)
   - Add entries to `FILENAME_PARSERS` (keyed by exact filename) or `getSuffixParser` (for patterns like `*.csproj`)

4. Add fixture files in `tests/fixtures/<ecosystem>/` — at minimum one valid sample covering all VRC categories the parser handles, with inline comments marking each VRC (e.g. `// vrc-caret`).

5. Add a test file `tests/parsers/<ecosystem>.test.ts` structured as:
   - A `describe("Version specifier/range handling")` block with inline unit tests per VRC/VRHP case. Test names follow the pattern `"vrc-X — description"`. Each `expect(...)` line carries a `// vrc-X → vrhp-Y` comment.
   - Separate `describe("<ParseFunctionName>")` blocks for fixture-based integration and edge-case tests.

---

## Adding a New MCP Tool

1. Create `src/tools/<tool-name>.ts`. Export a registration function:
   ```ts
   export function registerMyTool(server: McpServer, repoPath: string): void {
     server.registerTool("my_tool", {
       title: "...",
       description: "...",
       inputSchema: { /* zod schemas */ },
       annotations: { readOnlyHint: true/false, openWorldHint: true/false },
     }, async (inputs) => {
       // ...
       return { content: [{ type: "text", text: "..." }] };
     });
   }
   ```

2. Import and call your registration function in `src/index.ts`.

3. **Annotations**:
   - `readOnlyHint: true` — tool only reads data (safe to auto-approve in MCP clients)
   - `readOnlyHint: false` — tool mutates state (client will prompt user for confirmation)
   - `openWorldHint: true` — tool makes external network requests

4. Add unit tests in `tests/` covering the tool's logic (not the MCP wiring — test the underlying functions directly).

---

## API Client Patterns

### OSV.dev (src/api/osv.ts)
- Uses native `fetch()` (Node 18+)
- Batches queries in groups of 1000 (OSV limit)
- No auth, no rate limiting needed
- Always returns results even on partial failures (skips failed batches, logs to stderr)

### NVD (src/api/nvd.ts)
- Rate-limited: 5 req/30s without `NVD_API_KEY`, 50 req/30s with key
- Uses a simple time-delta delay between requests (`lastRequestTime`)
- Returns `null` on any failure (caller must check and degrade gracefully)

### CISA KEV (src/api/kev.ts)
- Downloads the full ~300KB catalog on first call, caches in module-level `Map`
- `_resetKevCache()` exported for tests
- Returns `{ available: false }` on download failure

All API errors are logged to `console.error()` — **never to stdout** (stdout is reserved for MCP JSON-RPC).

---

## Accepted Risk Persistence

`accepted.yml` schema:

```yaml
accepted_risks:
  - id: "uuid-v4"           # crypto.randomUUID()
    cve_id: "CVE-XXXX-YYYY"
    reason: "string"
    expires_on: "YYYY-MM-DD"  # required, max 1 year without confirmation
    accepted_at: "ISO 8601"   # set by server
    accepted_by: "optional"   # reserved for future git user integration
    severity_at_acceptance: "CRITICAL"  # optional, snapshot at time of acceptance
    cvss_score_at_acceptance: 9.8       # optional, snapshot at time of acceptance
```

Rules enforced server-side:
- `expires_on` is required — rejected without it
- Expiry ≤ 1 year from now: accepted immediately
- Expiry > 1 year: returns a warning and requires `confirm_extended_expiry=true` on retry
- Expired acceptances are never auto-removed — they resurface as `⚠️` warnings on every scan

File location priority: `GHOSTFREE_ACCEPTED_PATH` env → `.ghostfree/accepted.yml` in repo root.

---

## Testing Locally

### Build
```bash
npm run build
```

Uses `tsup` (not plain `tsc`) to bundle all of `src/` into a single `dist/index.js`. This matters because Node's ESM runtime does not support directory imports (`./python` → `./python/index.js`), which would require every import to carry an explicit `.js` extension. `tsup` resolves this at bundle time — the output is one portable file with no resolution issues, a smaller cold-start footprint for `npx` users, and `moduleResolution: "bundler"` in `tsconfig.json` remains accurate.

### Unit tests (no network)
```bash
npm test
# or watch mode:
npm run test:watch
```

### Integration tests (requires network; hits real APIs)
```bash
npm run test:integration
```

Integration tests use extended timeouts (30s). NVD integration tests are skipped unless `NVD_API_KEY` is set.

### Start the server manually with MCP Inspector
```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts --repo-path .
```

### Run directly in dev mode
```bash
npx tsx src/index.ts --repo-path /path/to/test/repo
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| TypeScript + npx | Zero-install distribution — every VS Code user has Node. Reference MCP SDK. |
| `tsup` for bundling | Plain `tsc` emits the same directory structure as `src/`, which breaks Node ESM's directory import resolution. `tsup` bundles everything into a single `dist/index.js`, eliminating that class of bug and reducing `npx` cold-start time. |
| OSV.dev as primary | No auth, generous rate limits, native package+version input, severity + fix versions included |
| NVD/KEV as enrichment only | NVD is rate-limited (5 req/30s). KEV download is 300KB. Both called per-CVE on demand, never in bulk scan path. |
| MCP Prompt (`/ghostfree.scan`) | Individual tools alone produce non-deterministic agent flow. The prompt enforces discover → severity check → scan → paginated present → triage → enrich → remediate. |
| Tool annotations (`readOnlyHint`) | MCP clients use this to decide whether to auto-approve or prompt the user. Read-only tools are safe to auto-approve; write tools are not. |
| Mandatory `expires_on` | Prevents indefinite "sweep it under the rug" risk acceptances. 1-year cap with override requires explicit confirmation, creating an audit trail. |
| `console.error()` for all logs | stdout is the MCP JSON-RPC channel. Any non-JSON written to stdout corrupts the protocol. |
| VRC + VRHP taxonomy | Named concepts (not numbers) survive reordering. VRC captures the *meaning* of a specifier; VRHP captures the *action* taken. Both are human-readable and machine-searchable across spec files, source, fixtures, and tests. |
| Per-parser `*.spec.md` | The spec file is the single source of truth for version range handling logic. Maintainers and AI assistants read it before touching source. Keeps intent visible and reviewable without reading implementation. |
| Parser subdirectories | Each ecosystem's `index.ts` + `*.spec.md` files live together. Adding an ecosystem is a self-contained unit of work with no changes needed outside `parsers/index.ts`. |
| No transitive deps (MVP) | Lock files give transitive coverage for some ecosystems, but full transitive resolution requires ecosystem-specific tooling. Planned as a stretch goal. |
