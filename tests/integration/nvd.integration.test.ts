import { describe, it, expect } from "vitest";
import { fetchNvdCve } from "../../src/api/nvd.js";

describe("NVD API (integration)", () => {
  const hasApiKey = Boolean(process.env["NVD_API_KEY"]);

  it("fetches CVE-2021-23337 from NVD", async () => {
    const result = await fetchNvdCve("CVE-2021-23337");
    // May return null if rate-limited without an API key, so skip gracefully
    if (result == null) {
      console.warn("NVD returned null — possibly rate-limited. Skipping assertions.");
      return;
    }
    expect(result.cvssV3BaseScore).toBeGreaterThan(0);
    expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(result.cvssV3Severity);
    expect(result.cweIds).toBeDefined();
    expect(result.references.length).toBeGreaterThan(0);
  });

  it("returns null for a non-existent CVE ID", async () => {
    const result = await fetchNvdCve("CVE-9999-99999");
    expect(result).toBeNull();
  });

  it.skipIf(!hasApiKey)("uses API key when NVD_API_KEY is set", async () => {
    const result = await fetchNvdCve("CVE-2021-44228"); // Log4Shell
    expect(result).not.toBeNull();
    expect(result!.cvssV3Severity).toBe("CRITICAL");
  });
});
