import { describe, it, expect } from "vitest";
import { parsePackageJson, parsePackageLockJson } from "../../src/parsers/node"; 
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) => readFileSync(join(__dirname, "../fixtures", sub), "utf8");

describe("Version specifier/range handling", () => {
  describe("parsePackageJson", () => {
    it("vrc-caret — extracts lower bound from caret range", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "^4.17.21" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "4.17.21", ecosystem: "npm" }); // vrhp-extract-lower
    });

    it("vrc-tilde — extracts lower bound from tilde range", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "~4.17.0" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "4.17.0", ecosystem: "npm" }); // vrhp-extract-lower
    });

    it("vrc-compound — extracts lower bound from >= compound range", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: ">=4.17.0 <5.0.0" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "4.17.0", ecosystem: "npm" }); // vrhp-extract-lower
    });

    it("vrc-wildcard — skips *", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "*" } }));
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-tag — skips 'latest' tag", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "latest" } }));
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-upper-bound-only — skips < specifier", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "<2.0.0" } }));
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-minimum — extracts version from > specifier", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: ">1.0.0" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "1.0.0", ecosystem: "npm" }); // vrhp-extract-lower
    });

    it("vrc-exact — extracts version from = specifier", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "=4.0.0" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "4.0.0", ecosystem: "npm" }); // vrhp-extract-lower
    });

    it("vrc-workspace-ref — skips workspace protocol", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { pkg: "workspace:^1.0.0" } }));
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "1.0.0-beta.1" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "1.0.0-beta.1", ecosystem: "npm" }); // vrhp-preserve-prerelease
    });

    it("vrc-caret + vrc-prerelease — preserves prerelease from caret range", () => {
      const deps = parsePackageJson(JSON.stringify({ dependencies: { lodash: "^1.0.0-rc.2" } }));
      expect(deps).toContainEqual({ name: "lodash", version: "1.0.0-rc.2", ecosystem: "npm" }); // vrhp-extract-lower
    });
  });

  // parsePackageLockJson — no range handling tests needed.
  // Lock-file versions are always exact pins resolved by the package manager (vrhp-lockfile).
});

describe("parsePackageJson", () => {
  it("parses all version formats from fixture", () => {
    const deps = parsePackageJson(fixture("node/package.json"));
    // vrc-caret → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "lodash", version: "4.17.20", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "jest", version: "29.0.0", ecosystem: "npm" });
    // vrc-tilde → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "express", version: "4.18.2", ecosystem: "npm" });
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "axios", version: "1.4.0", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "typescript", version: "5.0.0", ecosystem: "npm" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "prerelease-pkg", version: "1.0.0-beta.1", ecosystem: "npm" });
    // vrc-caret + vrc-prerelease → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "caret-prerelease", version: "2.0.0-rc.1", ecosystem: "npm" });
    // vrc-compound → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "gte-range", version: "1.2.0", ecosystem: "npm" });
    // vrc-exclusive-minimum → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "gt-pkg", version: "1.0.0", ecosystem: "npm" });
    // vrc-exact → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "eq-pkg", version: "3.0.0", ecosystem: "npm" });
  });

  it("skips vrhp-skip entries from fixture", () => {
    const deps = parsePackageJson(fixture("node/package.json"));
    const names = deps.map((d) => d.name);
    // vrc-wildcard → vrhp-skip
    expect(names).not.toContain("star-pkg");
    // vrc-tag → vrhp-skip
    expect(names).not.toContain("latest-pkg");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("lt-pkg");
    // vrc-workspace-ref → vrhp-skip
    expect(names).not.toContain("workspace-star");
    expect(names).not.toContain("workspace-caret");
  });

  it("returns empty for package.json with no dep sections", () => {
    const deps = parsePackageJson(JSON.stringify({ name: "empty" }));
    expect(deps).toHaveLength(0);
  });

  it("returns empty on invalid JSON", () => {
    expect(parsePackageJson("not json")).toHaveLength(0);
  });

  it("skips workspace protocol entries", () => {
    const pkg = JSON.stringify({ dependencies: { pkg: "workspace:*" } });
    expect(parsePackageJson(pkg)).toHaveLength(0);
  });
});

describe("parsePackageLockJson", () => {
  it("parses v1 format", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        lodash: { version: "4.17.20" },
        express: { version: "4.18.2" },
      },
    });
    const deps = parsePackageLockJson(lock);
    expect(deps).toContainEqual({ name: "lodash", version: "4.17.20", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "express", version: "4.18.2", ecosystem: "npm" });
  });

  it("parses v2 packages format from fixture", () => {
    const deps = parsePackageLockJson(fixture("node/package-lock.json"));
    expect(deps).toContainEqual({ name: "express", version: "4.18.2", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "lodash", version: "4.17.21", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "jest", version: "29.0.0", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "ms", version: "2.1.3", ecosystem: "npm" });
    expect(deps).toContainEqual({ name: "accepts", version: "1.3.8", ecosystem: "npm" });
    // Root package (empty key) should not appear
    expect(deps.every((d) => d.name !== "")).toBe(true);
  });

  it("returns empty on invalid JSON", () => {
    expect(parsePackageLockJson("bad")).toHaveLength(0);
  });
});
