import { describe, it, expect, beforeEach } from "vitest";
import { setCachedDeps, getCachedDeps } from "../src/dep-cache.js";

describe("dep-cache", () => {
  beforeEach(() => {
    // Reset cache between tests
    setCachedDeps([]);
  });

  it("returns null-ish empty array when no deps have been cached", () => {
    setCachedDeps([]);
    expect(getCachedDeps()).toEqual([]);
  });

  it("stores and retrieves dependencies", () => {
    const deps = [
      { name: "express", version: "4.17.1", ecosystem: "npm" },
      { name: "lodash", version: "4.17.21", ecosystem: "npm" },
    ];
    setCachedDeps(deps);
    expect(getCachedDeps()).toEqual(deps);
  });

  it("overwrites previous cache on subsequent setCachedDeps call", () => {
    setCachedDeps([{ name: "old-pkg", version: "1.0.0", ecosystem: "npm" }]);
    const newDeps = [{ name: "new-pkg", version: "2.0.0", ecosystem: "npm" }];
    setCachedDeps(newDeps);
    expect(getCachedDeps()).toEqual(newDeps);
    expect(getCachedDeps()!.length).toBe(1);
  });

  it("returns the same reference (not a copy)", () => {
    const deps = [{ name: "foo", version: "1.0.0", ecosystem: "npm" }];
    setCachedDeps(deps);
    expect(getCachedDeps()).toBe(deps);
  });
});
