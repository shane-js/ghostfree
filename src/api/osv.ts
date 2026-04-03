import type { Dependency, Vulnerability, Severity } from "../types.js";

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_VULN_URL = "https://api.osv.dev/v1/vulns";
const BATCH_SIZE = 1000;
const FETCH_CONCURRENCY = 10;

interface OsvQuery {
  package: { name: string; ecosystem: string };
  version: string;
}

interface OsvSeverity {
  type: string;
  score: string;
}

interface OsvRangeEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

interface OsvAffectedRange {
  type: string;
  repo?: string;
  events: OsvRangeEvent[];
  database_specific?: {
    versions?: OsvRangeEvent[];
  };
}

interface OsvAffectedVersion {
  ranges?: OsvAffectedRange[];
  versions?: string[];
}

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffectedVersion[];
  database_specific?: { severity?: string };
  published?: string;
  modified?: string;
}

/** Stub returned by batch endpoint (only id + modified) */
interface OsvBatchVuln {
  id: string;
  modified?: string;
}

interface OsvBatchResult {
  vulns?: OsvBatchVuln[];
}

interface OsvBatchResponse {
  results: OsvBatchResult[];
}

/**
 * Map CVSS score to a qualitative severity label.
 * Per FIRST.org CVSS v3.1/v4.0 Specification, Section 6 "Qualitative Severity Rating Scale":
 *   None: 0.0 | Low: 0.1–3.9 | Medium: 4.0–6.9 | High: 7.0–8.9 | Critical: 9.0–10.0
 * https://www.first.org/cvss/v4.0/specification-document#Qualitative-Severity-Rating-Scale
 */
function scoreToSeverity(score: number): Severity {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  if (score > 0) return "LOW";
  return "UNKNOWN";
}

// --- CVSS v3.x base-score calculator ---

const AV_VALUES: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.20 };
const AC_VALUES: Record<string, number> = { L: 0.77, H: 0.44 };
const PR_VALUES_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_VALUES_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.50 };
const UI_VALUES: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA_VALUES: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

function roundUp1(x: number): number {
  return Math.ceil(x * 10) / 10;
}

/** Parse a CVSS v3.x vector string and compute the base score */
export function parseCvssV3Vector(vector: string): number | null {
  // e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
  if (!vector.startsWith("CVSS:3")) return null;

  const metrics: Record<string, string> = {};
  for (const part of vector.split("/")) {
    const [key, val] = part.split(":");
    if (key && val) metrics[key] = val;
  }

  const av = AV_VALUES[metrics.AV];
  const ac = AC_VALUES[metrics.AC];
  const ui = UI_VALUES[metrics.UI];
  const s = metrics.S; // U or C
  const pr = s === "C" ? PR_VALUES_CHANGED[metrics.PR] : PR_VALUES_UNCHANGED[metrics.PR];
  const c = CIA_VALUES[metrics.C];
  const i = CIA_VALUES[metrics.I];
  const a = CIA_VALUES[metrics.A];

  if ([av, ac, pr, ui, c, i, a].some((v) => v === undefined) || !s) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact =
    s === "C"
      ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
      : 6.42 * iss;

  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * pr * ui;

  return s === "C"
    ? roundUp1(Math.min(1.08 * (impact + exploitability), 10))
    : roundUp1(Math.min(impact + exploitability, 10));
}

/** Extract CVSS base score from OSV severity array */
export function extractSeverity(severities: OsvSeverity[] | undefined, dbSeverity?: string): { severity: Severity; cvssScore?: number } {
  if (severities?.length) {
    for (const s of severities) {
      // Try as bare numeric score first
      const numeric = parseFloat(s.score);
      if (!isNaN(numeric) && !s.score.startsWith("CVSS:")) {
        return { severity: scoreToSeverity(numeric), cvssScore: numeric };
      }
      // Try as CVSS v3 vector string
      if (s.type === "CVSS_V3" || s.score.startsWith("CVSS:3")) {
        const score = parseCvssV3Vector(s.score);
        if (score !== null) return { severity: scoreToSeverity(score), cvssScore: score };
      }
    }
  }

  // Fall back to database_specific.severity (e.g. GHSA "HIGH", "CRITICAL")
  if (dbSeverity) {
    const upper = dbSeverity.toUpperCase();
    if (upper === "CRITICAL" || upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") {
      return { severity: upper as Severity };
    }
  }

  return { severity: "UNKNOWN" };
}

/** Heuristic: looks like a full git commit hash (40 hex chars) */
function isGitHash(s: string): boolean {
  return /^[0-9a-f]{40}$/i.test(s);
}

/** Extract the fixed versions from OSV affected ranges */
function extractFixedVersions(affected: OsvAffectedVersion[] | undefined): string[] {
  const fixed: string[] = [];
  if (!affected) return fixed;
  for (const a of affected) {
    for (const range of a.ranges ?? []) {
      // For GIT ranges, prefer database_specific.versions which has human-readable versions
      if (range.type === "GIT" && range.database_specific?.versions) {
        for (const ev of range.database_specific.versions) {
          if (ev.fixed) fixed.push(ev.fixed);
        }
        continue;
      }
      // For SEMVER/ECOSYSTEM ranges, extract from events
      for (const ev of range.events) {
        if (ev.fixed && !isGitHash(ev.fixed)) fixed.push(ev.fixed);
      }
    }
  }
  return [...new Set(fixed)];
}

/** Extract affected version list from OSV affected block */
function extractAffectedVersions(affected: OsvAffectedVersion[] | undefined): string[] {
  const versions: string[] = [];
  if (!affected) return versions;
  for (const a of affected) {
    versions.push(...(a.versions ?? []));
  }
  return versions;
}

/** Fetch full vulnerability details by ID */
async function fetchVulnById(id: string): Promise<OsvVuln | null> {
  try {
    const res = await fetch(`${OSV_VULN_URL}/${encodeURIComponent(id)}`);
    if (!res.ok) {
      console.error(`[ghostfree] OSV vuln fetch error for ${id}: ${res.status}`);
      return null;
    }
    return (await res.json()) as OsvVuln;
  } catch (err) {
    console.error(`[ghostfree] OSV vuln fetch failed for ${id}:`, err);
    return null;
  }
}

/** Fetch multiple vuln IDs with bounded concurrency */
async function fetchVulnsByConcurrency(ids: string[]): Promise<Map<string, OsvVuln>> {
  const result = new Map<string, OsvVuln>();
  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + FETCH_CONCURRENCY);
    const fetched = await Promise.all(chunk.map((id) => fetchVulnById(id)));
    for (let j = 0; j < chunk.length; j++) {
      const vuln = fetched[j];
      if (vuln) result.set(chunk[j], vuln);
    }
  }
  return result;
}

/**
 * Ecosystems supported by OSV.dev that our parsers produce.
 * Packages with other ecosystems are silently
 * skipped since OSV rejects unknown ecosystems with 400, killing the
 * entire batch.
 * https://ossf.github.io/osv-schema/#affectedpackage-field
 */
const OSV_SUPPORTED_ECOSYSTEMS = new Set([
  "npm",
  "PyPI",
  "Go",
  "Maven",
  "NuGet",
  "crates.io",
  "Packagist",
  "RubyGems",
  "Hex",
  "Pub",
  "Hackage",
  "SwiftURL",
  "ConanCenter",
  "CRAN",
  "Bioconductor",
]);

/** Query OSV.dev for vulnerabilities across all provided dependencies */
export async function queryOsv(deps: Dependency[]): Promise<Vulnerability[]> {
  if (deps.length === 0) return [];

  // Filter to ecosystems OSV actually supports
  const supported = deps.filter((d) => OSV_SUPPORTED_ECOSYSTEMS.has(d.ecosystem));
  const skipped = deps.length - supported.length;
  if (skipped > 0) {
    const unsupported = [...new Set(deps.filter((d) => !OSV_SUPPORTED_ECOSYSTEMS.has(d.ecosystem)).map((d) => d.ecosystem))];
    console.error(`[ghostfree] Skipping ${skipped} deps with unsupported OSV ecosystems: ${unsupported.join(", ")}`);
  }
  if (supported.length === 0) return [];

  // Phase 1: batch query to get vuln IDs per dependency
  // Map: vuln ID → set of dep indices that are affected
  const vulnIdToDeps = new Map<string, Set<number>>();

  for (let i = 0; i < supported.length; i += BATCH_SIZE) {
    const batch = supported.slice(i, i + BATCH_SIZE);
    const queries: OsvQuery[] = batch.map((d) => ({
      package: { name: d.name, ecosystem: d.ecosystem },
      version: d.version,
    }));

    let response: OsvBatchResponse;
    try {
      const res = await fetch(OSV_BATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
      });
      if (!res.ok) {
        console.error(`[ghostfree] OSV API error: ${res.status} ${res.statusText}`);
        continue;
      }
      response = (await res.json()) as OsvBatchResponse;
    } catch (err) {
      console.error(`[ghostfree] OSV fetch failed:`, err);
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const depIndex = i + j;
      const batchResult = response.results[j];
      if (!batchResult?.vulns?.length) continue;

      for (const stub of batchResult.vulns) {
        const existing = vulnIdToDeps.get(stub.id);
        if (existing) {
          existing.add(depIndex);
        } else {
          vulnIdToDeps.set(stub.id, new Set([depIndex]));
        }
      }
    }
  }

  if (vulnIdToDeps.size === 0) return [];

  console.error(`[ghostfree] Found ${vulnIdToDeps.size} unique vulnerability IDs, fetching details…`);

  // Phase 2: fetch full details for each unique vuln ID
  const fullVulns = await fetchVulnsByConcurrency([...vulnIdToDeps.keys()]);

  // Phase 3: build Vulnerability objects, one per (vuln, dep) pair
  const results: Vulnerability[] = [];

  for (const [vulnId, depIndices] of vulnIdToDeps) {
    const vuln = fullVulns.get(vulnId);
    if (!vuln) continue;

    const { severity, cvssScore } = extractSeverity(vuln.severity, vuln.database_specific?.severity);
    const aliases = vuln.aliases ?? [];

    // Prefer a CVE alias as the primary ID
    const cveAlias = aliases.find((a) => a.startsWith("CVE-"));
    const id = cveAlias ?? vuln.id;
    const remainingAliases = aliases.filter((a) => a !== id);
    if (!remainingAliases.includes(vuln.id) && vuln.id !== id) {
      remainingAliases.push(vuln.id);
    }

    for (const depIndex of depIndices) {
      const dep = supported[depIndex];
      results.push({
        id,
        aliases: remainingAliases,
        summary: vuln.summary ?? "",
        severity,
        cvssScore,
        fixedVersions: extractFixedVersions(vuln.affected),
        affectedVersions: extractAffectedVersions(vuln.affected),
        ecosystem: dep.ecosystem,
        packageName: dep.name,
        published: vuln.published,
        modified: vuln.modified,
      });
    }
  }

  return results;
}
