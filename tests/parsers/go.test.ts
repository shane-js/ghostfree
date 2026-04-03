import { describe, it, expect } from "vitest";
import { parseGoMod, parseGoSum } from "../../src/parsers/go";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) => readFileSync(join(__dirname, "../fixtures", sub), "utf8");

describe("Version specifier/range handling", () => {
  describe("parseGoMod", () => {
    // Go versions in go.mod are semantic versions (e.g., v1.9.1) without range specifiers.
    // Versions are pinned; no caret, tilde, or compound ranges.

    it("vrc-prerelease — preserves prerelease tag, strips v prefix", () => {
      const content = `module example.com/m\ngo 1.20\nrequire github.com/foo/bar v1.0.0-beta.1\n`;
      const deps = parseGoMod(content);
      expect(deps).toContainEqual({ name: "github.com/foo/bar", version: "1.0.0-beta.1", ecosystem: "Go" }); // vrhp-passthrough
    });

    it("vrc-build-metadata — preserves build metadata, strips v prefix", () => {
      const content = `module example.com/m\ngo 1.20\nrequire github.com/foo/bar v1.0.0+build.123\n`;
      const deps = parseGoMod(content);
      expect(deps).toContainEqual({ name: "github.com/foo/bar", version: "1.0.0+build.123", ecosystem: "Go" }); // vrhp-passthrough
    });
  });

  describe("parseGoSum", () => {
    // Go versions in go.sum are pinned semantic versions; no range specifiers.

    it("vrc-prerelease — preserves prerelease tag in sum entries", () => {
      const content = "github.com/foo/bar v1.0.0-rc.1 h1:abc\n";
      const deps = parseGoSum(content);
      expect(deps).toContainEqual({ name: "github.com/foo/bar", version: "1.0.0-rc.1", ecosystem: "Go" }); // vrhp-lockfile
    });
  });
});

describe("parseGoMod", () => {
  it("parses require block from fixture", () => {
    const deps = parseGoMod(fixture("go/go.mod"));
    expect(deps).toContainEqual({ name: "github.com/gin-gonic/gin", version: "1.9.1", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "github.com/stretchr/testify", version: "1.8.4", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "golang.org/x/net", version: "0.14.0", ecosystem: "Go" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "github.com/example/prerelease", version: "1.0.0-beta.1", ecosystem: "Go" });
    // vrc-build-metadata → vrhp-passthrough
    expect(deps).toContainEqual({ name: "github.com/example/buildmeta", version: "2.0.0+build.123", ecosystem: "Go" });
  });

  it("parses indirect single-line require", () => {
    const deps = parseGoMod(fixture("go/go.mod"));
    expect(deps).toContainEqual({ name: "golang.org/x/text", version: "0.12.0", ecosystem: "Go" });
  });

  it("skips replace directives", () => {
    const deps = parseGoMod(fixture("go/go.mod"));
    const names = deps.map((d) => d.name);
    expect(names).not.toContain("github.com/old/pkg");
  });

  it("parses single-line require (no block)", () => {
    const content = `module example.com/m\ngo 1.20\nrequire github.com/foo/bar v1.2.3\n`;
    const deps = parseGoMod(content);
    expect(deps).toContainEqual({ name: "github.com/foo/bar", version: "1.2.3", ecosystem: "Go" });
  });
});

describe("parseGoSum", () => {
  it("parses modules from fixture, deduplicates and skips /go.mod lines", () => {
    const deps = parseGoSum(fixture("go/go.sum"));
    expect(deps).toContainEqual({ name: "github.com/gin-gonic/gin", version: "1.9.1", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "github.com/stretchr/testify", version: "1.8.4", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "golang.org/x/net", version: "0.14.0", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "golang.org/x/text", version: "0.12.0", ecosystem: "Go" });
    // vrc-prerelease → vrhp-lockfile
    expect(deps).toContainEqual({ name: "github.com/example/prerelease", version: "1.0.0-rc.1", ecosystem: "Go" });
    // /go.mod checksum lines must not produce separate entries
    const ginEntries = deps.filter((d) => d.name === "github.com/gin-gonic/gin");
    expect(ginEntries).toHaveLength(1);
  });

  it("deduplicates module entries (inline)", () => {
    const content = [
      "github.com/foo/bar v1.2.3 h1:abc",
      "github.com/foo/bar v1.2.3/go.mod h1:def",
      "github.com/baz/qux v2.0.0 h1:xyz",
    ].join("\n");
    const deps = parseGoSum(content);
    expect(deps).toHaveLength(2);
    expect(deps).toContainEqual({ name: "github.com/foo/bar", version: "1.2.3", ecosystem: "Go" });
    expect(deps).toContainEqual({ name: "github.com/baz/qux", version: "2.0.0", ecosystem: "Go" });
  });
});
