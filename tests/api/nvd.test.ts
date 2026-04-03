import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchNvdCve, _resetNvdRateLimit } from "../../src/api/nvd.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  _resetNvdRateLimit();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["NVD_API_KEY"];
});

const mockFetch = () => vi.mocked(fetch);

function makeNvdResponse(overrides: Record<string, unknown> = {}) {
  return {
    vulnerabilities: [
      {
        cve: {
          id: "CVE-2021-23337",
          metrics: {
            cvssMetricV31: [
              {
                cvssData: {
                  vectorString: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H",
                  baseScore: 7.2,
                  baseSeverity: "HIGH",
                },
              },
            ],
          },
          weaknesses: [{ description: [{ value: "CWE-77" }] }],
          references: [{ url: "https://github.com/lodash/lodash/issues/5247" }],
          ...overrides,
        },
      },
    ],
  };
}

describe("fetchNvdCve", () => {
  it("parses CVSS, CWE, and references from NVD response", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => makeNvdResponse(),
    } as Response);

    const result = await fetchNvdCve("CVE-2021-23337");
    expect(result).not.toBeNull();
    expect(result!.cvssV3BaseScore).toBe(7.2);
    expect(result!.cvssV3Severity).toBe("HIGH");
    expect(result!.cvssV3Vector).toContain("CVSS:3.1");
    expect(result!.cweIds).toContain("CWE-77");
    expect(result!.references).toContain("https://github.com/lodash/lodash/issues/5247");
  });

  it("includes API key in header when NVD_API_KEY is set", async () => {
    process.env["NVD_API_KEY"] = "test-key-123";
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => makeNvdResponse(),
    } as Response);

    await fetchNvdCve("CVE-2021-23337");
    const headers = mockFetch().mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["apiKey"]).toBe("test-key-123");
  });

  it("returns null on HTTP error", async () => {
    mockFetch().mockResolvedValue({ ok: false, status: 404 } as Response);
    const result = await fetchNvdCve("CVE-9999-9999");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch().mockRejectedValue(new Error("Network error"));
    const result = await fetchNvdCve("CVE-2021-23337");
    expect(result).toBeNull();
  });

  it("returns null when no vulnerabilities in response", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () => ({ vulnerabilities: [] }),
    } as Response);
    const result = await fetchNvdCve("CVE-2021-23337");
    expect(result).toBeNull();
  });

  it("filters out NVD-CWE-Other placeholder weaknesses", async () => {
    mockFetch().mockResolvedValue({
      ok: true,
      json: async () =>
        makeNvdResponse({
          weaknesses: [{ description: [{ value: "NVD-CWE-Other" }, { value: "CWE-79" }] }],
        }),
    } as Response);

    const result = await fetchNvdCve("CVE-2021-23337");
    expect(result!.cweIds).not.toContain("NVD-CWE-Other");
    expect(result!.cweIds).toContain("CWE-79");
  });
});
