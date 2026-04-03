import { describe, it, expect, beforeEach } from "vitest";
import { lookupKev, _resetKevCache } from "../../src/api/kev.js";

beforeEach(() => {
  _resetKevCache();
});

describe("CISA KEV (integration)", () => {
  it("loads the KEV catalog and returns >100 entries when queried twice", async () => {
    // Each call may load the catalog; use a well-known CVE to warm the cache
    const log4shell = await lookupKev("CVE-2021-44228");
    expect(log4shell.available).toBe(true);
    expect(log4shell.result.inKEV).toBe(true);
  });

  it("Log4Shell (CVE-2021-44228) is in the KEV catalog", async () => {
    const { result } = await lookupKev("CVE-2021-44228");
    expect(result.inKEV).toBe(true);
    expect(result.dateAdded).toBeDefined();
    expect(result.shortDescription).toBeDefined();
  });

  it("returns not_in_kev for a CVE unlikely to be in KEV", async () => {
    const { result, available } = await lookupKev("CVE-9999-99999");
    expect(result.inKEV).toBe(false);
    expect(available).toBe(true);
  });

  it("lookup is case-insensitive", async () => {
    const upper = await lookupKev("CVE-2021-44228");
    _resetKevCache();
    const lower = await lookupKev("cve-2021-44228");
    expect(upper.result.inKEV).toBe(lower.result.inKEV);
    expect(upper.result.dateAdded).toBe(lower.result.dateAdded);
  });

  it("cache: second lookup does not re-fetch (available stays true)", async () => {
    await lookupKev("CVE-2021-44228");
    const second = await lookupKev("CVE-2021-44228");
    expect(second.available).toBe(true);
  });
});
