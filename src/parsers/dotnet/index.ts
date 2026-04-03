import type { Dependency } from "../../types.js";

interface CsprojDoc {
  Project?: {
    ItemGroup?: ItemGroup | ItemGroup[];
  };
}

interface ItemGroup {
  PackageReference?: PackageRef | PackageRef[];
}

interface PackageRef {
  "@_Include"?: string;
  "@_Version"?: string;
  Version?: string;
}

/**
 * Parse *.csproj content using fast-xml-parser.
 *
 * NuGet PackageReference supports several version formats. We handle them per principle:
 *
 * vrhp-extract-lower:
 *   [1.0,2.0)  Inclusive interval: lower bound 1.0 is concrete → queried as "1.0".
 *   6.*        Wildcard: the minimum of the 6.x series is 6.0 → queried as "6.0".
 *              (same reasoning as ^6.0.0 in npm/Rust which we already query as "6.0.0")
 *
 * vrhp-skip:
 *   (4.1.3,)   Exclusive lower bound: 4.1.3 itself is not allowed, and we cannot
 *              know the true minimum (could be 4.1.4, 4.2.0, 5.0.0, …).
 *   (,1.0]     Upper-bound-only. No lower bound at all.
 *
 * vrhp-preserve-prerelease: "1.0.0-beta" passes through as-is.
 * vrhp-passthrough: Bare exact version "6.1" passes through as the installed pin.
 */
export function parseCsproj(
  content: string,
  xmlParse: (s: string, opts?: Record<string, unknown>) => unknown
): Dependency[] {
  const deps: Dependency[] = [];
  let doc: CsprojDoc;
  try {
    doc = xmlParse(content, { ignoreAttributes: false, attributeNamePrefix: "@_" }) as CsprojDoc;
  } catch {
    return deps;
  }

  const rawGroups = doc?.Project?.ItemGroup;
  if (!rawGroups) return deps;
  const groups: ItemGroup[] = Array.isArray(rawGroups) ? rawGroups : [rawGroups];

  for (const group of groups) {
    const refs = group.PackageReference;
    if (!refs) continue;
    const list: PackageRef[] = Array.isArray(refs) ? refs : [refs];
    for (const ref of list) {
      const name = ref["@_Include"]?.trim();
      const raw = (ref["@_Version"] ?? ref.Version)?.trim();
      if (!name || !raw) continue;

      let version: string | undefined;

      if (raw.startsWith("[") && raw.includes(",")) {
        // Inclusive interval [lower,upper) or [lower,upper] — extract lower bound (vrhp-extract-lower).
        const lower = raw.slice(1).split(",")[0].trim();
        if (/^\d/.test(lower)) version = lower;
        // else: something like [,1.0] — no lower bound, skip (vrhp-skip).
      } else if (raw.startsWith("(")) {
        // Exclusive lower bound, e.g. (4.1.3,) or (1.0,2.0) — the stated version
        // is explicitly excluded, so the true minimum is unknown; skip (vrhp-skip).
      } else if (raw.includes("*")) {
        // Wildcard range e.g. 6.* or 6.0.* — replace the trailing .* or * with .0 (vrhp-extract-lower).
        // 6.*   → 6.0   (minimum of the 6.x series)
        // 6.0.* → 6.0.0 (minimum of the 6.0.x series)
        const expanded = raw.replace(/\.\*/g, ".0").replace(/\*$/, "0");
        if (/^\d/.test(expanded)) version = expanded;
      } else if (/^\d/.test(raw)) {
        // Bare exact or prerelease version (vrhp-passthrough / vrhp-preserve-prerelease).
        version = raw;
      }

      if (version) deps.push({ name, version, ecosystem: "NuGet" });
    }
  }
  return deps;
}

interface PackagesConfig {
  packages?: {
    package?: PkgRef | PkgRef[];
  };
}

interface PkgRef {
  "@_id"?: string;
  "@_version"?: string;
}

/**
 * Parse packages.config content using fast-xml-parser.
 *
 * vrhp-passthrough: packages.config always uses exact pinned versions in the
 * version attribute. Range constraints go in a separate allowedVersions
 * attribute which we do not read. No version validation needed.
 */
export function parsePackagesConfig(
  content: string,
  xmlParse: (s: string, opts?: Record<string, unknown>) => unknown
): Dependency[] {
  const deps: Dependency[] = [];
  let doc: PackagesConfig;
  try {
    doc = xmlParse(content, { ignoreAttributes: false, attributeNamePrefix: "@_" }) as PackagesConfig;
  } catch {
    return deps;
  }

  const rawPkgs = doc?.packages?.package;
  if (!rawPkgs) return deps;
  const list: PkgRef[] = Array.isArray(rawPkgs) ? rawPkgs : [rawPkgs];
  for (const pkg of list) {
    const name = pkg["@_id"]?.trim();
    const version = pkg["@_version"]?.trim();
    if (name && version) {
      deps.push({ name, version, ecosystem: "NuGet" });
    }
  }
  return deps;
}
