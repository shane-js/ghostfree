import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { XMLParser } from "fast-xml-parser";
import type { Dependency } from "../types.js";
import { parseRequirementsTxt, parsePyprojectToml, parsePipfileLock, parseSetupCfg } from "./python/index.js";
import { parsePackageJson, parsePackageLockJson } from "./node/index.js";
import { parseGoMod, parseGoSum } from "./go/index.js";
import { parseCargoToml, parseCargoLock } from "./rust/index.js";
import { parsePomXml, parseBuildGradle } from "./java/index.js";
import { parseCsproj, parsePackagesConfig } from "./dotnet/index.js";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const xmlParse = (s: string) => xmlParser.parse(s) as unknown;

/** Directories to skip during recursive walk */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "vendor",
  ".ghostfree",
]);

/** Map of filename (or suffix pattern) → parser function */
type ParserFn = (content: string, filePath: string) => Dependency[];

const FILENAME_PARSERS: Record<string, ParserFn> = {
  "requirements.txt": (c) => parseRequirementsTxt(c),
  "pyproject.toml": (c) => parsePyprojectToml(c, parseToml as (s: string) => Record<string, unknown>),
  "Pipfile.lock": (c) => parsePipfileLock(c),
  "setup.cfg": (c) => parseSetupCfg(c),
  "package.json": (c) => parsePackageJson(c),
  "package-lock.json": (c) => parsePackageLockJson(c),
  "go.mod": (c) => parseGoMod(c),
  "go.sum": (c) => parseGoSum(c),
  "Cargo.toml": (c) => parseCargoToml(c, parseToml as (s: string) => Record<string, unknown>),
  "Cargo.lock": (c) => parseCargoLock(c, parseToml as (s: string) => Record<string, unknown>),
  "pom.xml": (c) => parsePomXml(c, xmlParse),
  "build.gradle": (c) => parseBuildGradle(c),
  "build.gradle.kts": (c) => parseBuildGradle(c),
};

/** Suffix-based parsers for patterns like *.csproj and packages.config */
function getSuffixParser(filename: string): ParserFn | null {
  if (filename.endsWith(".csproj")) return (c) => parseCsproj(c, xmlParse);
  if (filename === "packages.config") return (c) => parsePackagesConfig(c, xmlParse);
  return null;
}

/** Recursively walk a directory, parse manifest files, and return all dependencies */
export async function discoverDependencies(repoPath: string): Promise<Dependency[]> {
  const allDeps: Dependency[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent<string>[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" }) as import("node:fs").Dirent<string>[];
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const parserFn = FILENAME_PARSERS[entry.name] ?? getSuffixParser(entry.name);
        if (!parserFn) continue;
        const filePath = path.join(dir, entry.name);
        let content: string;
        try {
          content = await fs.readFile(filePath, "utf8");
        } catch {
          continue;
        }
        try {
          const deps = parserFn(content, filePath);
          allDeps.push(...deps);
        } catch {
          // Silently skip unparseable files
        }
      }
    }
  }

  await walk(repoPath);
  return deduplicateDeps(allDeps);
}

/** Deduplicate by name+version+ecosystem */
function deduplicateDeps(deps: Dependency[]): Dependency[] {
  const seen = new Set<string>();
  return deps.filter((d) => {
    const key = `${d.ecosystem}:${d.name}:${d.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
