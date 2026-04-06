import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { Severity } from "./types.js";

const DEFAULT_DIR = ".ghostfree";
const CONFIG_FILE = "config.yml";

export interface GhostFreeConfig {
  min_severity?: Severity;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/** Resolve the .ghostfree directory, honoring GHOSTFREE_DIR if set */
function resolveGhostfreeDir(repoPath: string): string {
  return process.env["GHOSTFREE_DIR"] ?? path.join(repoPath, DEFAULT_DIR);
}

export function resolveConfigPath(repoPath: string): string {
  return path.join(resolveGhostfreeDir(repoPath), CONFIG_FILE);
}

/** Read .ghostfree/config.yml. Returns {} if the file doesn't exist. */
export async function readConfig(repoPath: string): Promise<GhostFreeConfig> {
  const filePath = resolveConfigPath(repoPath);
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = yaml.load(content) as GhostFreeConfig | null;
    return parsed ?? {};
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") return {};
    throw err;
  }
}

/** Write .ghostfree/config.yml, creating the directory if needed. */
export async function writeConfig(repoPath: string, config: GhostFreeConfig): Promise<void> {
  const filePath = resolveConfigPath(repoPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const header = "# GhostFree configuration — https://github.com/shane-js/ghostfree\n";
  await fs.writeFile(filePath, header + yaml.dump(config), "utf8");
}
