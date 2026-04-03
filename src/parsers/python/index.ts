import type { Dependency } from "../../types.js";

/**
 * Matches requirements.txt / setup.cfg version specifiers with a lower bound.
 *
 * Accepted operators: == (exact), === (arbitrary equality), >= (minimum),
 * > (exclusive minimum), ~= (compatible release).
 *
 * vrhp-skip: Operators <=, <, != are NOT matched by this
 * regex, so dependencies with only those specifiers are silently skipped.
 *
 * vrhp-preserve-prerelease: The version capture group [^\s,;#]+ includes
 * hyphens, so "1.0.0-beta" is captured intact.
 *
 * @example "requests==2.28.0"       → ["requests", "2.28.0"]
 * @example "requests>=2.28.0,<3.0"  → ["requests", "2.28.0"] (stops at comma)
 * @example "requests<=3.0"          → no match (skipped)
 * @example "requests!=2.0"          → no match (skipped)
 */
const PINNED_RE = /^([A-Za-z0-9_.\-]+)\s*(?:===?|~=|>=?)\s*([^\s,;#]+)/;
// Matches extras: name[extra]==1.0.0
const EXTRAS_RE = /^([A-Za-z0-9_.\-]+)\[.*?\]/;

/** Parse requirements.txt content */
export function parseRequirementsTxt(content: string): Dependency[] {
  const deps: Dependency[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    // Strip inline comments
    const stripped = line.split("#")[0].trim();
    // Strip extras bracket before matching
    const normalized = stripped.replace(EXTRAS_RE, "$1");
    const m = PINNED_RE.exec(normalized);
    if (m) {
      deps.push({ name: m[1], version: m[2], ecosystem: "PyPI" });
    }
  }
  return deps;
}

/** Parse pyproject.toml content (PEP 621 + Poetry) */
export function parsePyprojectToml(
  content: string,
  parse: (s: string) => Record<string, unknown>
): Dependency[] {
  const deps: Dependency[] = [];
  let doc: Record<string, unknown>;
  try {
    doc = parse(content);
  } catch {
    return deps;
  }

  // PEP 621: [project].dependencies = ["requests>=2.28.0"]
  const project = doc["project"] as Record<string, unknown> | undefined;
  const projectDeps = project?.["dependencies"];
  if (Array.isArray(projectDeps)) {
    for (const specifier of projectDeps) {
      if (typeof specifier !== "string") continue;
      const m = PINNED_RE.exec(specifier.replace(EXTRAS_RE, "$1"));
      if (m) deps.push({ name: m[1], version: m[2], ecosystem: "PyPI" });
    }
  }

  // Poetry: [tool.poetry.dependencies] = { requests = "^2.28.0" }
  const tool = doc["tool"] as Record<string, unknown> | undefined;
  const poetry = tool?.["poetry"] as Record<string, unknown> | undefined;
  const poetryDeps = poetry?.["dependencies"] as Record<string, unknown> | undefined;
  if (poetryDeps) {
    for (const [name, val] of Object.entries(poetryDeps)) {
      if (name === "python") continue;
      const version =
        typeof val === "string"
          ? val
          : typeof val === "object" && val !== null && "version" in val
            ? String((val as Record<string, unknown>)["version"])
            : null;
      if (version) {
        // vrhp-extract-lower: Strip leading ^, ~, >= to extract lower-bound version.
        // vrhp-skip: Do NOT strip < or ! — exclusions (!=) and upper-bounds (<) must
        //     fail the /^\d/ guard so they are skipped, not queried.
        // vrhp-preserve-prerelease: Prerelease tags (e.g. 1.0.0-beta) survive — they start with a digit.
        const cleaned = version.replace(/^[\^~>=]+/, "").split(",")[0].trim();
        if (cleaned && /^\d/.test(cleaned)) deps.push({ name, version: cleaned, ecosystem: "PyPI" });
      }
    }
  }

  return deps;
}

/** Parse Pipfile.lock content (JSON) */
export function parsePipfileLock(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return deps;
  }
  for (const section of ["default", "develop"] as const) {
    const packages = doc[section] as Record<string, unknown> | undefined;
    if (!packages) continue;
    for (const [name, meta] of Object.entries(packages)) {
      const version =
        typeof meta === "object" &&
        meta !== null &&
        "version" in meta
          ? String((meta as Record<string, unknown>)["version"]).replace(/^==/, "")
          : null;
      if (version) deps.push({ name, version, ecosystem: "PyPI" });
    }
  }
  return deps;
}

/** Parse setup.cfg content ([options].install_requires) */
export function parseSetupCfg(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let inInstallRequires = false;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "[options]") continue;
    if (line === "install_requires =") {
      inInstallRequires = true;
      continue;
    }
    if (inInstallRequires) {
      if (line.startsWith("[") || (!line && !rawLine.startsWith(" "))) {
        inInstallRequires = false;
        continue;
      }
      if (!line || line.startsWith("#")) continue;
      const m = PINNED_RE.exec(line.replace(EXTRAS_RE, "$1"));
      if (m) deps.push({ name: m[1], version: m[2], ecosystem: "PyPI" });
    }
  }
  return deps;
}
