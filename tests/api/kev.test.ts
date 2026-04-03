import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupKev, _resetKevCache } from "../../src/api/kev.js";

beforeEach(() => {
  _resetKevCache();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  _resetKevCache();
});

const mockFetch = () => vi.mocked(fetch);

function makeKevCatalog(entries: Array<{ cveID: string; dateAdded?: string; shortDescription?: string }>) {
  return { vulnerabilities: entries };
}

describe("lookupKev", () => {
  it("returns inKEV=true with metadata for a known CVE", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () =>
        makeKevCatalog([
          {
            cveID: "CVE-2021-44228",
            dateAdded: "2021-12-10",
            shortDescription: "Log4Shell RCE",
          },
        ]),
    } as Response);

    const { result, available } = await lookupKev("CVE-2021-44228");
    expect(available).toBe(true);
    expect(result.inKEV).toBe(true);
    expect(result.dateAdded).toBe("2021-12-10");
    expect(result.shortDescription).toBe("Log4Shell RCE");
  });

  it("returns inKEV=false for a CVE not in catalog", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => makeKevCatalog([{ cveID: "CVE-2021-44228" }]),
    } as Response);

    const { result, available } = await lookupKev("CVE-9999-9999");
    expect(available).toBe(true);
    expect(result.inKEV).toBe(false);
  });

  it("caches the catalog — fetch is called only once for multiple lookups", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => makeKevCatalog([{ cveID: "CVE-2021-44228" }]),
    } as Response);

    await lookupKev("CVE-2021-44228");
    await lookupKev("CVE-9999-9999");
    await lookupKev("CVE-2021-44228");

    expect(mockFetch()).toHaveBeenCalledTimes(1);
  });

  it("is case-insensitive for CVE IDs", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => makeKevCatalog([{ cveID: "CVE-2021-44228" }]),
    } as Response);

    const { result } = await lookupKev("cve-2021-44228");
    expect(result.inKEV).toBe(true);
  });

  it("returns available=false on fetch failure", async () => {
    mockFetch().mockRejectedValue(new Error("Network failure"));
    const { result, available } = await lookupKev("CVE-2021-44228");
    expect(available).toBe(false);
    expect(result.inKEV).toBe(false);
  });

  it("returns available=false on HTTP error", async () => {
    mockFetch().mockResolvedValue({ ok: false, status: 503 } as Response);
    const { result, available } = await lookupKev("CVE-2021-44228");
    expect(available).toBe(false);
    expect(result.inKEV).toBe(false);
  });
});
