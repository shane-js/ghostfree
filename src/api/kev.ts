const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

interface KevEntry {
  cveID: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
}

interface KevCatalog {
  vulnerabilities: KevEntry[];
}

interface KevLookupResult {
  inKEV: boolean;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
}

// In-memory cache — populated on first call, reused for the session
let kevCache: Map<string, KevEntry> | null = null;
let kevAvailable = true;

/** Fetch and cache the CISA KEV catalog. Returns null if unavailable. */
async function loadKev(): Promise<Map<string, KevEntry> | null> {
  if (kevCache !== null) return kevCache;
  if (!kevAvailable) return null;

  try {
    const res = await fetch(KEV_URL);
    if (!res.ok) {
      console.error(`[ghostfree] KEV fetch error: ${res.status}`);
      kevAvailable = false;
      return null;
    }
    const data = (await res.json()) as KevCatalog;
    const map = new Map<string, KevEntry>();
    for (const entry of data.vulnerabilities ?? []) {
      map.set(entry.cveID.toUpperCase(), entry);
    }
    kevCache = map;
    return kevCache;
  } catch (err) {
    console.error("[ghostfree] KEV fetch failed:", err);
    kevAvailable = false;
    return null;
  }
}

/** Look up a CVE in the CISA KEV catalog */
export async function lookupKev(cveId: string): Promise<{ result: KevLookupResult; available: boolean }> {
  const catalog = await loadKev();
  if (catalog === null) {
    return { result: { inKEV: false }, available: false };
  }

  const entry = catalog.get(cveId.toUpperCase());
  if (!entry) {
    return { result: { inKEV: false }, available: true };
  }

  return {
    result: {
      inKEV: true,
      dateAdded: entry.dateAdded,
      shortDescription: entry.shortDescription,
      requiredAction: entry.requiredAction,
      dueDate: entry.dueDate,
    },
    available: true,
  };
}

/** Synchronous check — only works after catalog has been loaded */
export function isInKev(cveId: string): boolean {
  if (!kevCache) return false;
  return kevCache.has(cveId.toUpperCase());
}

/** Reset cache — intended for tests only */
export function _resetKevCache(): void {
  kevCache = null;
  kevAvailable = true;
}
