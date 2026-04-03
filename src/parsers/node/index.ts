import type { Dependency } from "../../types.js";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * Extract a queryable version from a semver range string.
 *
 * Principles applied:
 * - vrhp-extract-lower: Strips ^, ~, >=, >, =, ! to extract the minimum version.
 * - vrhp-skip: Upper-bound-only specifiers (<2.0.0) are NOT
 *   stripped — the leading < survives, fails the /^\d/ guard, and returns null.
 *   Compound ranges like ">=1.0 <2.0" work: >= is stripped, whitespace split
 *   yields "1.0" (the lower bound). Unresolvable specifiers (*, latest,
 *   workspace:*) also fail the guard and return null.
 * - vrhp-preserve-prerelease: "1.0.0-beta.1" starts with a digit and passes
 *   through intact.
 *
 * @example cleanVersion("^1.2.3")           → "1.2.3"
 * @example cleanVersion(">=1.0.0 <2.0.0")   → "1.0.0"
 * @example cleanVersion("<2.0.0")           → null (upper-bound only)
 * @example cleanVersion("*")                → null (unresolvable)
 * @example cleanVersion("1.0.0-beta")       → "1.0.0-beta"
 */
function cleanVersion(range: string): string | null {
  const stripped = range.replace(/^[\^~>=! ]+/, "").split(/\s+/)[0].split(" ")[0];
  if (stripped && /^\d/.test(stripped)) return stripped;
  return null;
}

/** Parse package.json content */
export function parsePackageJson(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let doc: PackageJson;
  try {
    doc = JSON.parse(content) as PackageJson;
  } catch {
    return deps;
  }
  const sections: Array<Record<string, string>> = [];
  if (doc.dependencies) sections.push(doc.dependencies);
  if (doc.devDependencies) sections.push(doc.devDependencies);
  for (const section of sections) {
    for (const [name, range] of Object.entries(section)) {
      const version = cleanVersion(range);
      if (version) deps.push({ name, version, ecosystem: "npm" });
    }
  }
  return deps;
}

type LockV1 = {
  lockfileVersion?: number;
  dependencies?: Record<string, { version: string; dev?: boolean }>;
  packages?: Record<string, { version?: string }>;
};

/** Parse package-lock.json content (supports v1 and v2/v3 formats) */
export function parsePackageLockJson(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let doc: LockV1;
  try {
    doc = JSON.parse(content) as LockV1;
  } catch {
    return deps;
  }

  const version = doc.lockfileVersion ?? 1;

  if (version >= 2 && doc.packages) {
    // v2/v3: "packages" map — keys are paths like "node_modules/lodash"
    for (const [pkgPath, meta] of Object.entries(doc.packages)) {
      if (pkgPath === "") continue; // root package
      const name = pkgPath.replace(/^.*node_modules\//, "");
      const ver = meta.version;
      if (ver) deps.push({ name, version: ver, ecosystem: "npm" });
    }
  } else if (doc.dependencies) {
    // v1: "dependencies" map — keys are package names
    for (const [name, meta] of Object.entries(doc.dependencies)) {
      if (meta.version) deps.push({ name, version: meta.version, ecosystem: "npm" });
    }
  }
  return deps;
}
