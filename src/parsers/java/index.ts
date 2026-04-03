import type { Dependency } from "../../types.js";

interface XmlDependency {
  groupId?: string;
  artifactId?: string;
  version?: string;
}

interface ParsedPom {
  project?: {
    dependencies?: {
      dependency?: XmlDependency | XmlDependency[];
    };
  };
}

/** Parse pom.xml content using fast-xml-parser */
export function parsePomXml(
  content: string,
  xmlParse: (s: string, opts?: Record<string, unknown>) => unknown
): Dependency[] {
  const deps: Dependency[] = [];
  let doc: ParsedPom;
  try {
    doc = xmlParse(content, { ignoreAttributes: false }) as ParsedPom;
  } catch {
    return deps;
  }

  const rawDeps = doc?.project?.dependencies?.dependency;
  if (!rawDeps) return deps;

  const list: XmlDependency[] = Array.isArray(rawDeps) ? rawDeps : [rawDeps];
  for (const dep of list) {
    const groupId = dep.groupId?.trim() ?? "";
    const artifactId = dep.artifactId?.trim() ?? "";
    const raw = dep.version?.trim() ?? "";

    if (!raw || !groupId || !artifactId) continue;
    // Skip property placeholders like ${spring.version} (vrhp-skip).
    if (raw.startsWith("${")) continue;

    // Maven interval notation — same rules as NuGet (vrhp-extract-lower / vrhp-skip):
    let version: string;
    if (raw.startsWith("[") && raw.includes(",")) {
      // Inclusive lower bound [lower,upper) or [lower,upper] — extract lower (vrhp-extract-lower).
      const lower = raw.slice(1).split(",")[0].trim();
      if (!/^\d/.test(lower)) continue; // [,1.0] — no lower bound; skip (vrhp-skip).
      version = lower;
    } else if (raw.startsWith("(")) {
      // Exclusive lower bound — true minimum unknown; skip (vrhp-skip).
      continue;
    } else if (!/^\d/.test(raw)) {
      // Other non-version strings — skip.
      continue;
    } else {
      version = raw; // Exact version or prerelease (vrhp-passthrough / vrhp-preserve-prerelease).
    }

    deps.push({
      name: `${groupId}:${artifactId}`,
      version,
      ecosystem: "Maven",
    });
  }
  return deps;
}

/**
 * Gradle dependency extraction regex.
 *
 * Captures group:artifact:version from standard Gradle dependency declarations.
 * Supports both Groovy single-quote and Kotlin DSL double-quote syntax.
 *
 * Maven/Gradle interval notation is handled the same way as NuGet:
 * vrhp-extract-lower — [1.0,2.0)  Inclusive lower bound → queried as "1.0".
 * vrhp-skip — (4.1.3,)   Exclusive lower bound → true minimum unknown; skipped.
 * vrhp-skip — [,1.0]     No lower bound; skipped.
 * vrhp-preserve-prerelease — Prerelease tags ("32.1.2-jre", "1.0.0-SNAPSHOT") pass through intact.
 * vrhp-passthrough — Exact pinned versions pass through verbatim.
 *
 * Note: Gradle dynamic version "1.+" starts with a digit and currently passes
 * through as-is. OSV will simply return no results for it. Wildcard expansion
 * (as done for NuGet "6.*" → "6.0") is not implemented for Gradle "1.+" because
 * the "+" suffix is Gradle-specific and extremely rare in real manifests.
 */
const GRADLE_RE =
  /(?:implementation|compile|api|runtimeOnly|testImplementation|compileOnly)\s*[\("']([^"':]+:[^"':]+):([^"']+)["')]/g;

/** Parse build.gradle / build.gradle.kts content using regex */
export function parseBuildGradle(content: string): Dependency[] {
  // Create a new RegExp instance each call to avoid shared lastIndex state.
  // The pattern handles both: keyword("group:artifact:version") and keyword 'group:artifact:version'
  const gradleRe =
    /(?:implementation|compile|api|runtimeOnly|testImplementation|compileOnly)\s*\(?["']([^"':]+:[^"':]+):([^"']+)["']/g;
  const deps: Dependency[] = [];
  let m: RegExpExecArray | null;
  while ((m = gradleRe.exec(content)) !== null) {
    const name = m[1].trim();
    // Strip trailing quotes/parens left by the regex delimiter (e.g. [1.0,2.0) → [1.0,2.0).
    const raw = m[2].trim().replace(/["')]+$/, "");
    if (!name || !raw) continue;

    // Maven interval notation — same rules as NuGet (vrhp-extract-lower / vrhp-skip):
    let version: string;
    if (raw.startsWith("[") && raw.includes(",")) {
      // Inclusive lower bound — extract it (vrhp-extract-lower).
      const lower = raw.slice(1).split(",")[0].trim();
      if (!/^\d/.test(lower)) continue; // [,1.0] — no lower bound; skip (vrhp-skip).
      version = lower;
    } else if (raw.startsWith("(")) {
      // Exclusive lower bound — true minimum unknown; skip (vrhp-skip).
      continue;
    } else if (!/^\d/.test(raw)) {
      continue;
    } else {
      version = raw;
    }

    deps.push({ name, version, ecosystem: "Maven" });
  }
  return deps;
}
