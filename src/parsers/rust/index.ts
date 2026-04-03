import type { Dependency } from "../../types.js";

/**
 * Parse Cargo.toml content using smol-toml.
 *
 * Version range handling:
 * - vrhp-extract-lower: Strips ^, ~, >=, >, = to extract minimum version.
 *   Splits on comma to take only the first (lower) constraint.
 * - vrhp-skip: The strip set does NOT include < or !.
 *   "<1.0" → "<1.0" → fails /^\d/ guard → skipped. Wildcard "*" is stripped
 *   to empty → skipped.
 * - vrhp-preserve-prerelease: "1.0.0-beta" starts with a digit and passes
 *   through intact after stripping.
 *
 * @example "^1.0.100"       → "1.0.100"
 * @example ">=0.5, <1.0"    → "0.5"
 * @example "<1.0"           → null (upper-bound only)
 * @example "*"              → null (unresolvable)
 * @example "1.0.0-beta"     → "1.0.0-beta"
 */
export function parseCargoToml(
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

  const dependencies = doc["dependencies"] as Record<string, unknown> | undefined;
  if (!dependencies) return deps;

  for (const [name, val] of Object.entries(dependencies)) {
    let version: string | null = null;

    if (typeof val === "string") {
      // { serde = "1.0" }
      version = val;
    } else if (typeof val === "object" && val !== null) {
      const meta = val as Record<string, unknown>;
      // Workspace deps have no local version
      if (meta["workspace"] === true) continue;
      if (typeof meta["version"] === "string") {
        version = meta["version"];
      }
    }

    if (version) {
      // Strip leading ^, ~, >=, etc.
      const cleaned = version.replace(/^[\^~>=*]+/, "").split(",")[0].trim();
      if (cleaned && /^\d/.test(cleaned)) {
        deps.push({ name, version: cleaned, ecosystem: "crates.io" });
      }
    }
  }
  return deps;
}

/** Parse Cargo.lock content using smol-toml — reads [[package]] entries */
export function parseCargoLock(
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

  const packages = doc["package"];
  if (!Array.isArray(packages)) return deps;

  for (const pkg of packages) {
    if (typeof pkg !== "object" || pkg === null) continue;
    const p = pkg as Record<string, unknown>;
    const name = typeof p["name"] === "string" ? p["name"] : null;
    const version = typeof p["version"] === "string" ? p["version"] : null;
    if (name && version) {
      deps.push({ name, version, ecosystem: "crates.io" });
    }
  }
  return deps;
}
