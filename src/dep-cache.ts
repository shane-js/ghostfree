import type { Dependency } from "./types.js";

let cached: Dependency[] | null = null;

export function setCachedDeps(deps: Dependency[]): void {
  cached = deps;
}

export function getCachedDeps(): Dependency[] | null {
  return cached;
}
