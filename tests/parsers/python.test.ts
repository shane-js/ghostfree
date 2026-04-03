import { describe, it, expect } from "vitest";
import {
  parseRequirementsTxt,
  parsePyprojectToml,
  parsePipfileLock,
  parseSetupCfg,
} from "../../src/parsers/python";
import { parse as parseToml } from "smol-toml";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) =>
  readFileSync(join(__dirname, "../fixtures", sub), "utf8");

describe("Version specifier/range handling", () => {
  describe("parseRequirementsTxt", () => {
    it("vrc-exact — extracts version from == specifier", () => {
      const deps = parseRequirementsTxt("requests==2.28.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-passthrough
    });

    it("vrc-inclusive-minimum — extracts lower bound from >= specifier", () => {
      const deps = parseRequirementsTxt("requests>=2.28.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-compatible-release — extracts version from ~= specifier", () => {
      const deps = parseRequirementsTxt("requests~=2.28\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-compound — extracts lower bound from compound >=,< range", () => {
      const deps = parseRequirementsTxt("requests>=2.28.0,<3.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips <= specifier", () => {
      const deps = parseRequirementsTxt("requests<=3.0\n");
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusion — skips != specifier", () => {
      const deps = parseRequirementsTxt("requests!=2.0\n");
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-upper-bound-only — skips < specifier", () => {
      const deps = parseRequirementsTxt("requests<3.0\n");
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-minimum — extracts version from > specifier", () => {
      const deps = parseRequirementsTxt("requests>2.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-exact — extracts version from === arbitrary equality specifier", () => {
      const deps = parseRequirementsTxt("requests===2.0.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.0.0", ecosystem: "PyPI" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const deps = parseRequirementsTxt("requests==1.0.0-beta\n");
      expect(deps).toContainEqual({ name: "requests", version: "1.0.0-beta", ecosystem: "PyPI" }); // vrhp-passthrough
    });
  });

  describe("parsePyprojectToml", () => {
    it("vrc-caret — extracts lower bound from Poetry caret range", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\npython = "^3.11"\nrequests = "^2.28.0"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-compound — extracts lower bound from Poetry >= compound range", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\nrequests = ">=2.28,<3.0"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      expect(deps).toContainEqual({ name: "requests", version: "2.28", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-exclusion — skips != exclusion specifier", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\nrequests = "!=2.28.0"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      const names = deps.map((d) => d.name);
      expect(names).not.toContain("requests"); // vrhp-skip
    });

    it("vrc-tilde — extracts lower bound from Poetry tilde range", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\nrequests = "~2.28.0"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips Poetry < specifier", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\nrequests = "<3.0"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      const names = deps.map((d) => d.name);
      expect(names).not.toContain("requests"); // vrhp-skip
    });

    it("vrc-caret + vrc-prerelease — preserves prerelease in Poetry dep", () => {
      const deps = parsePyprojectToml(
        `[tool.poetry.dependencies]\nrequests = "^1.0.0-beta"\n`,
        parseToml as (s: string) => Record<string, unknown>
      );
      expect(deps).toContainEqual({ name: "requests", version: "1.0.0-beta", ecosystem: "PyPI" }); // vrhp-extract-lower
    });
  });

  // parsePipfileLock — no range handling tests needed.
  // Pipfile.lock versions are always exact pins resolved by pipenv (vrhp-lockfile).

  describe("parseSetupCfg", () => {
    it("vrc-exact — extracts version from == specifier", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests==2.28.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-passthrough
    });

    it("vrc-inclusive-minimum — extracts lower bound from >= specifier", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests>=2.28.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-compatible-release — extracts version from ~= specifier", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests~=2.28\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-compound — extracts lower bound from compound >=,< range", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests>=2.28.0,<3.0\n");
      expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips <= specifier", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests<=3.0\n");
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusion — skips != specifier", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests!=2.0\n");
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const deps = parseSetupCfg("[options]\ninstall_requires =\n    requests==1.0.0-beta\n");
      expect(deps).toContainEqual({ name: "requests", version: "1.0.0-beta", ecosystem: "PyPI" }); // vrhp-passthrough
    });
  });
});

describe("parseRequirementsTxt", () => {
  it("parses all version formats from fixture", () => {
    const deps = parseRequirementsTxt(fixture("python/requirements.txt"));
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "requests", version: "2.28.2", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "boto3", version: "1.26.0", ecosystem: "PyPI" });
    // vrc-inclusive-minimum → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "flask", version: "2.3.0", ecosystem: "PyPI" });
    // vrc-compatible-release → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "numpy", version: "1.24.0", ecosystem: "PyPI" });
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "custom-pkg", version: "1.0.0", ecosystem: "PyPI" });
    // vrc-exclusive-minimum → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "min-pkg", version: "2.0", ecosystem: "PyPI" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "pre-pkg", version: "1.0.0-beta", ecosystem: "PyPI" });
    // vrc-compound → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "compound", version: "2.0", ecosystem: "PyPI" });
    // Extras notation
    expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" });
  });

  it("skips vrhp-skip entries from fixture", () => {
    const deps = parseRequirementsTxt(fixture("python/requirements.txt"));
    const names = deps.map((d) => d.name);
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("upper-le");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("upper-lt");
    // vrc-exclusion → vrhp-skip
    expect(names).not.toContain("exclude-pkg");
  });

  it("skips comment-only lines and blank lines", () => {
    const deps = parseRequirementsTxt("# comment\n\nrequests==1.0.0\n");
    expect(deps).toHaveLength(1);
  });

  it("skips -r include lines", () => {
    const deps = parseRequirementsTxt("-r base.txt\nrequests==1.0.0\n");
    const names = deps.map((d) => d.name);
    expect(names).not.toContain("-r");
    expect(names).toContain("requests");
  });

  it("strips inline comments", () => {
    const deps = parseRequirementsTxt("boto3==1.26.0  # inline comment\n");
    expect(deps[0].version).toBe("1.26.0");
  });

  it("skips unpinned packages", () => {
    const deps = parseRequirementsTxt("unpinned-package\n");
    expect(deps).toHaveLength(0);
  });

  it("handles extras notation", () => {
    const deps = parseRequirementsTxt("requests[security]==2.28.0\n");
    expect(deps[0].name).toBe("requests");
    expect(deps[0].version).toBe("2.28.0");
  });
});

describe("parsePyprojectToml", () => {
  it("parses PEP 621 and Poetry deps from fixture", () => {
    const deps = parsePyprojectToml(
      fixture("python/pyproject.toml"),
      parseToml as (s: string) => Record<string, unknown>
    );
    // PEP 621
    expect(deps).toContainEqual({ name: "httpx", version: "0.24.0", ecosystem: "PyPI" });
    // Poetry: caret range
    expect(deps).toContainEqual({ name: "fastapi", version: "0.100.0", ecosystem: "PyPI" });
    // Poetry: table form exact
    expect(deps).toContainEqual({ name: "uvicorn", version: "0.22.0", ecosystem: "PyPI" });
    // Poetry: tilde range
    expect(deps).toContainEqual({ name: "aiohttp", version: "0.9.0", ecosystem: "PyPI" });
    // Poetry: compound range
    expect(deps).toContainEqual({ name: "starlette", version: "0.27", ecosystem: "PyPI" });
    // Poetry: prerelease preserved
    expect(deps).toContainEqual({ name: "beta-pkg", version: "2.0.0-alpha.1", ecosystem: "PyPI" });
  });

  it("skips vrhp-skip Poetry entries from fixture", () => {
    const deps = parsePyprojectToml(
      fixture("python/pyproject.toml"),
      parseToml as (s: string) => Record<string, unknown>
    );
    const names = deps.map((d) => d.name);
    // vrc-exclusion → vrhp-skip
    expect(names).not.toContain("legacy-pkg");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("ceiling-pkg");
  });

  it("skips python version entry in Poetry deps", () => {
    const deps = parsePyprojectToml(
      fixture("python/pyproject.toml"),
      parseToml as (s: string) => Record<string, unknown>
    );
    const names = deps.map((d) => d.name);
    expect(names).not.toContain("python");
  });

  it("returns empty on invalid TOML", () => {
    const deps = parsePyprojectToml(
      "not valid toml [[[",
      parseToml as (s: string) => Record<string, unknown>
    );
    expect(deps).toHaveLength(0);
  });
});

describe("parsePipfileLock", () => {
  it("parses default and develop sections from fixture", () => {
    const deps = parsePipfileLock(fixture("python/Pipfile.lock"));
    expect(deps).toContainEqual({ name: "requests", version: "2.28.2", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "certifi", version: "2023.7.22", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "pytest", version: "7.4.0", ecosystem: "PyPI" });
  });

  it("returns empty on invalid JSON", () => {
    expect(parsePipfileLock("not json")).toHaveLength(0);
  });
});

describe("parseSetupCfg", () => {
  it("parses install_requires block from fixture", () => {
    const deps = parseSetupCfg(fixture("python/setup.cfg"));
    expect(deps).toContainEqual({ name: "requests", version: "2.28.0", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "flask", version: "2.3.0", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "sqlalchemy", version: "2.0.20", ecosystem: "PyPI" });
    expect(deps).toContainEqual({ name: "celery", version: "5.3.0", ecosystem: "PyPI" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "pre-pkg", version: "1.0.0-beta", ecosystem: "PyPI" });
    // vrc-compatible-release → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "compat-pkg", version: "3.0", ecosystem: "PyPI" });
    // vrc-exclusive-minimum → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "gt-pkg", version: "1.5", ecosystem: "PyPI" });
  });

  it("returns empty when no install_requires", () => {
    expect(parseSetupCfg("[metadata]\nname = myapp\n")).toHaveLength(0);
  });
});
