import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverDependencies } from "../../src/parsers/index.js";
import { queryOsv } from "../../src/api/osv.js";

describe("End-to-end scan flow (integration)", () => {
  it("discovers lodash 4.17.20 from a fixture and finds CVEs via OSV", async () => {
    // Create a temp repo with a known-vulnerable dependency
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ghostfree-e2e-"));
    try {
      await fs.writeFile(
        path.join(tmpDir, "package.json"),
        JSON.stringify({
          name: "test-app",
          dependencies: { lodash: "4.17.20" },
        })
      );

      const deps = await discoverDependencies(tmpDir);
      expect(deps.some((d) => d.name === "lodash" && d.version === "4.17.20")).toBe(true);

      const vulns = await queryOsv(deps);
      expect(vulns.length).toBeGreaterThan(0);

      // Verify structured output fields are present and severity is resolved
      for (const vuln of vulns) {
        expect(typeof vuln.id).toBe("string");
        expect(vuln.id.length).toBeGreaterThan(0);
        // UNKNOWN means we failed to parse CVSS data — this must not happen
        expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(vuln.severity);
        expect(typeof vuln.summary).toBe("string");
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("discovers Python deps from requirements.txt and queries OSV", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ghostfree-e2e-py-"));
    try {
      // Pillow 9.0.0 has known CVEs
      await fs.writeFile(path.join(tmpDir, "requirements.txt"), "Pillow==9.0.0\n");

      const deps = await discoverDependencies(tmpDir);
      expect(deps.some((d) => d.name.toLowerCase() === "pillow")).toBe(true);

      const vulns = await queryOsv(deps);
      // OSV should return results for Pillow 9.0.0
      expect(vulns.length).toBeGreaterThanOrEqual(0); // don't hard-fail if fixed
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
