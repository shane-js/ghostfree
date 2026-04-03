import type { EnrichedCVE } from "../types.js";

const NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";

// Rate limiting: 5 req/30s without key, 50 req/30s with key
const REQUEST_DELAY_MS_NO_KEY = 6500; // ~5 req/30s with buffer
const REQUEST_DELAY_MS_WITH_KEY = 650; // ~50 req/30s with buffer

let lastRequestTime = 0;

/** Reset rate-limit timer — for tests only */
export function _resetNvdRateLimit(): void {
  lastRequestTime = 0;
}

async function rateLimitedFetch(url: string, apiKey?: string): Promise<Response> {
  const delay = apiKey ? REQUEST_DELAY_MS_WITH_KEY : REQUEST_DELAY_MS_NO_KEY;
  const now = Date.now();
  const wait = delay - (now - lastRequestTime);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  const headers: Record<string, string> = {};
  if (apiKey) headers["apiKey"] = apiKey;

  return fetch(url, { headers });
}

interface NvdCveItem {
  id?: string;
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData?: {
        vectorString?: string;
        baseScore?: number;
        baseSeverity?: string;
      };
    }>;
    cvssMetricV30?: Array<{
      cvssData?: {
        vectorString?: string;
        baseScore?: number;
        baseSeverity?: string;
      };
    }>;
  };
  weaknesses?: Array<{
    description?: Array<{ value?: string }>;
  }>;
  references?: Array<{ url?: string }>;
}

interface NvdResponse {
  vulnerabilities?: Array<{
    cve?: NvdCveItem;
  }>;
}

/** Fetch enrichment data for a single CVE from NVD API 2.0 */
export async function fetchNvdCve(cveId: string): Promise<EnrichedCVE["nvd"] | null> {
  const apiKey = process.env["NVD_API_KEY"];
  const url = `${NVD_BASE_URL}?cveId=${encodeURIComponent(cveId)}`;

  let response: Response;
  try {
    response = await rateLimitedFetch(url, apiKey);
  } catch (err) {
    console.error(`[ghostfree] NVD fetch failed for ${cveId}:`, err);
    return null;
  }

  if (!response.ok) {
    console.error(`[ghostfree] NVD API error for ${cveId}: ${response.status}`);
    return null;
  }

  let data: NvdResponse;
  try {
    data = (await response.json()) as NvdResponse;
  } catch {
    console.error(`[ghostfree] NVD response parse error for ${cveId}`);
    return null;
  }

  const cve = data.vulnerabilities?.[0]?.cve;
  if (!cve) return null;

  // Prefer v3.1, fall back to v3.0
  const metricV31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
  const metricV30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  const metric = metricV31 ?? metricV30;

  const cweIds: string[] = [];
  for (const weakness of cve.weaknesses ?? []) {
    for (const desc of weakness.description ?? []) {
      if (desc.value && desc.value !== "NVD-CWE-Other" && desc.value !== "NVD-CWE-noinfo") {
        cweIds.push(desc.value);
      }
    }
  }

  const references: string[] = (cve.references ?? [])
    .map((r) => r.url ?? "")
    .filter(Boolean);

  return {
    cvssV3Vector: metric?.vectorString,
    cvssV3BaseScore: metric?.baseScore,
    cvssV3Severity: metric?.baseSeverity,
    cweIds,
    references,
  };
}
