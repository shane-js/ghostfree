import type { Dependency } from "../../types.js";

/**
 * Go module version regexes.
 *
 * Go modules always use exact semantic versions (e.g. v1.9.1). The Go module
 * system does not support range specifiers — no ^, ~, >=, or interval notation.
 *
 * vrhp-preserve-prerelease: The regex explicitly captures prerelease and build
 * metadata via (?:[-+][^\s]*)? so versions like v1.0.0-beta.1 and
 * v1.0.0+build.123 pass through intact. The leading v prefix is stripped.
 *
 * vrhp-passthrough: All versions in go.mod and go.sum are pinned. No range
 * interpretation is needed.
 */
// Matches: github.com/foo/bar v1.2.3
const REQUIRE_LINE_RE = /^\s+([^\s]+)\s+(v[\d.]+(?:[-+][^\s]*)?)/;;
// Matches single-line: require github.com/foo/bar v1.2.3
const SINGLE_REQUIRE_RE = /^require\s+([^\s]+)\s+(v[\d.]+(?:[-+][^\s]*)?)/;
// go.sum line: module version hash — version may have /go.mod suffix
const SUM_LINE_RE = /^([^\s]+)\s+(v[\d.][^\s]*)(?:\/go\.mod)?\s+h1:/;

/** Parse go.mod content */
export function parseGoMod(content: string): Dependency[] {
  const deps: Dependency[] = [];
  let inRequireBlock = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (line === "require (") {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && line === ")") {
      inRequireBlock = false;
      continue;
    }

    if (inRequireBlock) {
      if (line.startsWith("//") || !line) continue;
      // Strip inline comments but preserve leading whitespace for regex match
      const stripped = rawLine.split("//")[0];
      const m = REQUIRE_LINE_RE.exec(stripped);
      if (m) {
        deps.push({
          name: m[1],
          version: m[2].replace(/^v/, ""),
          ecosystem: "Go",
        });
      }
      continue;
    }

    // Single-line require outside block
    const sm = SINGLE_REQUIRE_RE.exec(line);
    if (sm) {
      deps.push({
        name: sm[1],
        version: sm[2].replace(/^v/, ""),
        ecosystem: "Go",
      });
    }
  }
  return deps;
}

/** Parse go.sum content — returns pinned module+version pairs (deduped, no /go.mod entries) */
export function parseGoSum(content: string): Dependency[] {
  const seen = new Set<string>();
  const deps: Dependency[] = [];
  for (const line of content.split("\n")) {
    const m = SUM_LINE_RE.exec(line);
    if (!m) continue;
    const rawVersion = m[2];
    // Skip /go.mod hash entries
    if (rawVersion.endsWith("/go.mod")) continue;
    const key = `${m[1]}@${rawVersion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deps.push({
      name: m[1],
      version: rawVersion.replace(/^v/, ""),
      ecosystem: "Go",
    });
  }
  return deps;
}
