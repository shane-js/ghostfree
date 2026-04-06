import type { Severity } from "./types.js";
import { SEVERITY_ORDER } from "./types.js";

/** Parse a severity string, returning UNKNOWN for unrecognized values */
export function parseSeverity(raw: string | undefined): Severity {
  const upper = (raw ?? "").toUpperCase() as Severity;
  if (upper in SEVERITY_ORDER) return upper;
  return "UNKNOWN";
}

/** Return the minimum severity to surface. Falls back to MEDIUM if override is absent or unrecognized. */
export function resolveMinSeverity(override?: string): Severity {
  return parseSeverity(override) === "UNKNOWN" ? "MEDIUM" : parseSeverity(override);
}

/** True if `a` is at or above `threshold` in severity */
export function meetsThreshold(a: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[threshold];
}

/** Sort vulnerabilities by severity descending, then CVSS score descending, then by ID ascending */
export function sortBySeverity<T extends { severity: Severity; id: string; cvssScore?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;
    const scoreA = a.cvssScore ?? 0;
    const scoreB = b.cvssScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.id.localeCompare(b.id);
  });
}
