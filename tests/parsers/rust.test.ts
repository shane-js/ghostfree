import { describe, it, expect } from "vitest";
import { parseCargoToml, parseCargoLock } from "../../src/parsers/rust";
import { parse as parseToml } from "smol-toml";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) => readFileSync(join(__dirname, "../fixtures", sub), "utf8");
const tomlParse = parseToml as (s: string) => Record<string, unknown>;

describe("Version specifier/range handling", () => {
  describe("parseCargoToml", () => {
    it("vrc-caret — extracts lower bound from caret range", () => {
      const content = `[dependencies]\nserde = "^1.0.100"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "1.0.100", ecosystem: "crates.io" }); // vrhp-extract-lower
    });

    it("vrc-tilde — extracts lower bound from tilde range", () => {
      const content = `[dependencies]\nserde = "~1.0.0"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "1.0.0", ecosystem: "crates.io" }); // vrhp-extract-lower
    });

    it("vrc-compound — extracts lower bound from >= compound range", () => {
      const content = `[dependencies]\nserde = ">=0.5, <1.0"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "0.5", ecosystem: "crates.io" }); // vrhp-extract-lower
    });

    it("vrc-wildcard — skips *", () => {
      const content = `[dependencies]\nserde = "*"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-minimum — extracts version from > specifier", () => {
      const content = `[dependencies]\nserde = ">0.5"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "0.5", ecosystem: "crates.io" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips < specifier", () => {
      const content = `[dependencies]\nserde = "<1.0"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exact — extracts exact version from = specifier", () => {
      const content = `[dependencies]\nserde = "=1.0.0"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "1.0.0", ecosystem: "crates.io" }); // vrhp-extract-lower
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const content = `[dependencies]\nserde = "1.0.0-beta"\n`;
      const deps = parseCargoToml(content, tomlParse);
      expect(deps).toContainEqual({ name: "serde", version: "1.0.0-beta", ecosystem: "crates.io" }); // vrhp-passthrough
    });
  });

  // parseCargoLock — no range handling tests needed.
  // Lock-file versions are always exact pins resolved by Cargo (vrhp-lockfile).
});

describe("parseCargoToml", () => {
  it("parses all version formats from fixture", () => {
    const deps = parseCargoToml(fixture("rust/Cargo.toml"), tomlParse);
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "serde", version: "1.0.188", ecosystem: "crates.io" });
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "tokio", version: "1.32.0", ecosystem: "crates.io" });
    expect(deps).toContainEqual({ name: "reqwest", version: "0.11.20", ecosystem: "crates.io" });
    // vrc-caret → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "serde_json", version: "1.0.100", ecosystem: "crates.io" });
    // vrc-tilde → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "log", version: "0.4.0", ecosystem: "crates.io" });
    // vrc-compound → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "bytes", version: "1.0", ecosystem: "crates.io" });
    // vrc-exclusive-minimum → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "http", version: "0.2", ecosystem: "crates.io" });
    // vrc-exact → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "pin-project", version: "1.1.0", ecosystem: "crates.io" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "beta-dep", version: "0.5.0-beta.1", ecosystem: "crates.io" });
  });

  it("skips vrhp-skip and workspace entries from fixture", () => {
    const deps = parseCargoToml(fixture("rust/Cargo.toml"), tomlParse);
    const names = deps.map((d) => d.name);
    // vrc-workspace-ref
    expect(names).not.toContain("rand");
    // vrc-wildcard → vrhp-skip
    expect(names).not.toContain("any-dep");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("upper-dep");
  });

  it("returns empty on invalid TOML", () => {
    expect(parseCargoToml("!!!invalid", tomlParse)).toHaveLength(0);
  });
});

describe("parseCargoLock", () => {
  it("parses [[package]] entries from fixture", () => {
    const deps = parseCargoLock(fixture("rust/Cargo.lock"), tomlParse);
    expect(deps).toContainEqual({ name: "serde", version: "1.0.188", ecosystem: "crates.io" });
    expect(deps).toContainEqual({ name: "tokio", version: "1.32.0", ecosystem: "crates.io" });
    expect(deps).toContainEqual({ name: "reqwest", version: "0.11.20", ecosystem: "crates.io" });
    // Transitive deps (serde_derive, tokio-macros) are also included
    expect(deps).toContainEqual({ name: "serde_derive", version: "1.0.188", ecosystem: "crates.io" });
  });

  it("parses [[package]] entries (inline)", () => {
    const content = `
[[package]]
name = "serde"
version = "1.0.188"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "tokio"
version = "1.32.0"
`;
    const deps = parseCargoLock(content, tomlParse);
    expect(deps).toContainEqual({ name: "serde", version: "1.0.188", ecosystem: "crates.io" });
    expect(deps).toContainEqual({ name: "tokio", version: "1.32.0", ecosystem: "crates.io" });
  });
});
