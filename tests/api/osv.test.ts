import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { queryOsv, parseCvssV3Vector, extractSeverity } from "../../src/api/osv.js";
import type { Dependency } from "../../src/types.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockFetch = () => vi.mocked(fetch);

/** Helper: build a batch response that returns only stubs (id + modified) */
function makeBatchResponse(vulnIds: string[]) {
  return {
    results: [{ vulns: vulnIds.map((id) => ({ id, modified: "2024-01-01T00:00:00Z" })) }],
  };
}

/** Helper: build a full vuln object as returned by /v1/vulns/{id} */
function makeFullVuln(overrides: Partial<{
  id: string; aliases: string[]; summary: string;
  severity: Array<{ type: string; score: string }>;
  affected: unknown[]; database_specific: { severity?: string };
  published: string;
}>) {
  return {
    id: "GHSA-xxxx-xxxx-xxxx",
    aliases: [],
    summary: "",
    severity: [],
    affected: [],
    published: "2024-01-01T00:00:00Z",
    modified: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Set up fetch mock for the two-phase pattern:
 *  1st call → batch endpoint returns vuln ID stubs
 *  subsequent calls → individual /v1/vulns/{id} returns full details
 */
function setupTwoPhase(batchVulnIds: string[], fullVulns: Map<string, unknown>) {
  mockFetch().mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/v1/querybatch")) {
      return { ok: true, json: async () => makeBatchResponse(batchVulnIds) } as Response;
    }
    // Individual vuln fetch
    const id = url.split("/v1/vulns/")[1];
    const vuln = id ? fullVulns.get(decodeURIComponent(id)) : undefined;
    if (vuln) {
      return { ok: true, json: async () => vuln } as Response;
    }
    return { ok: false, status: 404, statusText: "Not Found" } as Response;
  });
}

describe("queryOsv", () => {
  it("returns empty array when no dependencies provided", async () => {
    const results = await queryOsv([]);
    expect(results).toHaveLength(0);
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("maps OSV response to Vulnerability objects (two-phase fetch)", async () => {
    const dep: Dependency = { name: "lodash", version: "4.17.20", ecosystem: "npm" };
    const fullVuln = makeFullVuln({
      id: "GHSA-jf85-cpcp-j695",
      aliases: ["CVE-2021-23337"],
      summary: "Command injection in lodash",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }],
      affected: [
        { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }], versions: ["4.17.20"] },
      ],
      published: "2021-02-15T00:00:00Z",
    });

    setupTwoPhase(["GHSA-jf85-cpcp-j695"], new Map([["GHSA-jf85-cpcp-j695", fullVuln]]));

    const results = await queryOsv([dep]);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("CVE-2021-23337");
    expect(results[0].severity).toBe("HIGH");
    expect(results[0].cvssScore).toBeGreaterThanOrEqual(7.0);
    expect(results[0].fixedVersions).toContain("4.17.21");
    expect(results[0].packageName).toBe("lodash");
    expect(results[0].ecosystem).toBe("npm");
  });

  it("returns empty array when OSV finds no vulns for a package", async () => {
    const dep: Dependency = { name: "safe-package", version: "1.0.0", ecosystem: "npm" };
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{}] }),
    } as Response);

    const results = await queryOsv([dep]);
    expect(results).toHaveLength(0);
  });

  it("continues when a batch fetch fails (logs error, returns partial)", async () => {
    const dep: Dependency = { name: "pkg", version: "1.0.0", ecosystem: "npm" };
    mockFetch().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" } as Response);

    const results = await queryOsv([dep]);
    expect(results).toHaveLength(0);
  });

  it("handles network error gracefully", async () => {
    const dep: Dependency = { name: "pkg", version: "1.0.0", ecosystem: "npm" };
    mockFetch().mockRejectedValue(new Error("Network error"));

    const results = await queryOsv([dep]);
    expect(results).toHaveLength(0);
  });

  it("assigns CRITICAL severity for CVSS >= 9.0", async () => {
    const dep: Dependency = { name: "log4j-core", version: "2.14.1", ecosystem: "Maven" };
    const fullVuln = makeFullVuln({
      id: "CVE-2021-44228",
      summary: "Log4Shell RCE",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H" }],
    });

    setupTwoPhase(["CVE-2021-44228"], new Map([["CVE-2021-44228", fullVuln]]));

    const results = await queryOsv([dep]);
    expect(results[0].severity).toBe("CRITICAL");
    expect(results[0].cvssScore).toBeGreaterThanOrEqual(9.0);
  });

  it("sends correct ecosystem in request body", async () => {
    const dep: Dependency = { name: "requests", version: "2.28.0", ecosystem: "PyPI" };
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{}] }),
    } as Response);

    await queryOsv([dep]);
    const body = JSON.parse(mockFetch().mock.calls[0][1]?.body as string) as {
      queries: Array<{ package: { ecosystem: string } }>;
    };
    expect(body.queries[0].package.ecosystem).toBe("PyPI");
  });

  it("deduplicates vuln IDs across multiple deps", async () => {
    const dep1: Dependency = { name: "lodash", version: "4.17.20", ecosystem: "npm" };
    const dep2: Dependency = { name: "underscore", version: "1.12.0", ecosystem: "npm" };
    const fullVuln = makeFullVuln({
      id: "GHSA-jf85-cpcp-j695",
      aliases: ["CVE-2021-23337"],
      summary: "Injection",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }],
    });

    // Both deps have the same vuln
    mockFetch().mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/v1/querybatch")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              { vulns: [{ id: "GHSA-jf85-cpcp-j695", modified: "" }] },
              { vulns: [{ id: "GHSA-jf85-cpcp-j695", modified: "" }] },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => fullVuln } as Response;
    });

    const results = await queryOsv([dep1, dep2]);
    // Should get one result per affected dep
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.packageName).sort();
    expect(names).toEqual(["lodash", "underscore"]);
  });

  it("filters out deps with unsupported ecosystems (e.g. oci)", async () => {
    const npmDep: Dependency = { name: "lodash", version: "4.17.20", ecosystem: "npm" };
    const ociDep: Dependency = { name: "node", version: "18-alpine", ecosystem: "oci" };
    const fullVuln = makeFullVuln({
      id: "GHSA-jf85-cpcp-j695",
      aliases: ["CVE-2021-23337"],
      summary: "Injection",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }],
    });

    setupTwoPhase(["GHSA-jf85-cpcp-j695"], new Map([["GHSA-jf85-cpcp-j695", fullVuln]]));

    const results = await queryOsv([npmDep, ociDep]);
    // Only the npm dep should be queried; oci should be skipped
    expect(results).toHaveLength(1);
    expect(results[0].packageName).toBe("lodash");

    // The batch call should only contain the npm dep, not the oci dep
    const batchCall = mockFetch().mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      return url.includes("/v1/querybatch");
    });
    expect(batchCall).toBeDefined();
    const body = JSON.parse((batchCall![1] as RequestInit).body as string);
    expect(body.queries).toHaveLength(1);
    expect(body.queries[0].package.ecosystem).toBe("npm");
  });

  it("returns empty array when all deps have unsupported ecosystems", async () => {
    const ociDep: Dependency = { name: "node", version: "18-alpine", ecosystem: "oci" };
    const results = await queryOsv([ociDep]);
    expect(results).toEqual([]);
    // fetch should never be called
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("extracts fixed version from GIT range database_specific.versions", async () => {
    const dep: Dependency = { name: "objection", version: "2.2.15", ecosystem: "npm" };
    const fullVuln = makeFullVuln({
      id: "CVE-2021-3766",
      summary: "Prototype Pollution in objection.js",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }],
      affected: [
        {
          ranges: [
            {
              type: "GIT",
              repo: "https://github.com/Vincit/objection.js",
              events: [{ introduced: "0" }, { fixed: "9bcd3a22aa0779cb2d3ec9bee99177b64b76646" }],
              database_specific: { versions: [{ introduced: "0" }, { fixed: "2.2.16" }] },
            },
          ],
          versions: ["2.2.15"],
        },
      ],
    });

    setupTwoPhase(["CVE-2021-3766"], new Map([["CVE-2021-3766", fullVuln]]));
    const results = await queryOsv([dep]);
    expect(results).toHaveLength(1);
    expect(results[0].fixedVersions).toContain("2.2.16");
    // Should NOT contain the git commit hash
    expect(results[0].fixedVersions.some((v: string) => /^[0-9a-f]{40}$/i.test(v))).toBe(false);
  });
});

describe("parseCvssV3Vector", () => {
  it("computes correct score for a critical vector (Log4Shell)", () => {
    const score = parseCvssV3Vector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
    expect(score).toBe(10.0);
  });

  it("computes correct score for a high-severity vector", () => {
    const score = parseCvssV3Vector("CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H");
    expect(score).toBeGreaterThanOrEqual(7.0);
    expect(score).toBeLessThan(9.0);
  });

  it("computes correct score for a medium vector", () => {
    const score = parseCvssV3Vector("CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:L");
    expect(score).toBeGreaterThanOrEqual(4.0);
    expect(score).toBeLessThan(7.0);
  });

  it("returns null for non-CVSS:3 strings", () => {
    expect(parseCvssV3Vector("CVSS:4.0/AV:N/AC:L/...")).toBeNull();
    expect(parseCvssV3Vector("not a vector")).toBeNull();
  });

  it("returns null for incomplete vectors", () => {
    expect(parseCvssV3Vector("CVSS:3.1/AV:N/AC:L")).toBeNull();
  });
});

describe("extractSeverity", () => {
  it("handles bare numeric score", () => {
    const result = extractSeverity([{ type: "CVSS_V3", score: "7.2" }]);
    expect(result.severity).toBe("HIGH");
    expect(result.cvssScore).toBe(7.2);
  });

  it("handles CVSS v3 vector string", () => {
    const result = extractSeverity([{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H" }]);
    expect(result.severity).toBe("CRITICAL");
    expect(result.cvssScore).toBe(10.0);
  });

  it("falls back to database_specific severity", () => {
    const result = extractSeverity([], "HIGH");
    expect(result.severity).toBe("HIGH");
    expect(result.cvssScore).toBeUndefined();
  });

  it("returns UNKNOWN when no severity info available", () => {
    const result = extractSeverity(undefined);
    expect(result.severity).toBe("UNKNOWN");
  });

  it("skips CVSS v4 vectors and falls back", () => {
    const result = extractSeverity(
      [{ type: "CVSS_V4", score: "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:P/VC:N/VI:N/VA:N/SC:L/SI:L/SA:L" }],
      "MEDIUM"
    );
    expect(result.severity).toBe("MEDIUM");
  });
});
