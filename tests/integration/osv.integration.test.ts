import { describe, it, expect } from "vitest";
import { queryOsv } from "../../src/api/osv.js";
import type { Dependency } from "../../src/types.js";

describe("OSV.dev API (integration)", () => {
  it("returns CVEs for a known-vulnerable lodash version", async () => {
    const deps: Dependency[] = [
      { name: "lodash", version: "4.17.20", ecosystem: "npm" },
    ];
    const results = await queryOsv(deps);
    expect(results.length).toBeGreaterThan(0);
    // lodash 4.17.20 has CVE-2021-23337 (prototype pollution)
    const ids = results.map((v) => v.id);
    const hasProtoPollu = ids.some((id) => id.includes("CVE-2021-23337") || id.includes("GHSA"));
    expect(hasProtoPollu).toBe(true);

    // Severity must be resolved — UNKNOWN means we failed to parse scores
    for (const v of results) {
      expect(v.severity).not.toBe("UNKNOWN");
    }

    // Fixed versions must be extracted — lodash 4.17.20 vulns have known fixes
    const cve23337 = results.find((v) => v.id === "CVE-2021-23337");
    expect(cve23337).toBeDefined();
    expect(cve23337!.fixedVersions.length).toBeGreaterThan(0);
    expect(cve23337!.fixedVersions).toContain("4.17.21");
  });

  it("returns no CVEs for a safe package version", async () => {
    // Use a synthetic package that is not in OSV
    const deps: Dependency[] = [
      { name: "nonexistent-package-ghostfree-test", version: "99.99.99", ecosystem: "npm" },
    ];
    const results = await queryOsv(deps);
    expect(results).toHaveLength(0);
  });

  it("returns real severity (not UNKNOWN) for found CVEs", async () => {
    const deps: Dependency[] = [
      { name: "lodash", version: "4.17.20", ecosystem: "npm" },
    ];
    const results = await queryOsv(deps);
    expect(results.length).toBeGreaterThan(0);
    for (const v of results) {
      expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(v.severity);
      // If severity was parsed from CVSS, we should have a numeric score
      if (v.cvssScore !== undefined) {
        expect(v.cvssScore).toBeGreaterThan(0);
        expect(v.cvssScore).toBeLessThanOrEqual(10);
      }
    }
  });

  it("handles empty dependency list gracefully", async () => {
    const results = await queryOsv([]);
    expect(results).toHaveLength(0);
  });
});
