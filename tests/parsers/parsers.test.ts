import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverDependencies } from "../../src/parsers";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ghostfree-discover-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("parsers/index", () => {
  describe("discoverDependencies", () => {
  it("returns empty array for an empty directory", async () => {
    const deps = await discoverDependencies(tmpDir);
    expect(deps).toHaveLength(0);
  });

  it("discovers dependencies from requirements.txt", async () => {
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "requests==2.28.0\nflask==2.3.0\n");
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "requests" && d.version === "2.28.0")).toBe(true);
    expect(deps.some((d) => d.name === "flask" && d.version === "2.3.0")).toBe(true);
    expect(deps.every((d) => d.ecosystem === "PyPI")).toBe(true);
  });

  it("discovers dependencies from package.json", async () => {
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { lodash: "^4.17.21" } })
    );
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "lodash" && d.ecosystem === "npm")).toBe(true);
  });

  it("discovers manifests in subdirectories", async () => {
    const subdir = path.join(tmpDir, "backend");
    await fs.mkdir(subdir, { recursive: true });
    await fs.writeFile(path.join(subdir, "requirements.txt"), "django==4.2.0\n");
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "django")).toBe(true);
  });

  it("skips node_modules directory", async () => {
    const nm = path.join(tmpDir, "node_modules", "some-pkg");
    await fs.mkdir(nm, { recursive: true });
    await fs.writeFile(
      path.join(nm, "package.json"),
      JSON.stringify({ dependencies: { evil: "1.0.0" } })
    );
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "evil")).toBe(false);
  });

  it("skips .git directory", async () => {
    const git = path.join(tmpDir, ".git");
    await fs.mkdir(git, { recursive: true });
    await fs.writeFile(path.join(git, "requirements.txt"), "gitpkg==1.0.0\n");
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "gitpkg")).toBe(false);
  });

  it("skips dist directory", async () => {
    const dist = path.join(tmpDir, "dist");
    await fs.mkdir(dist, { recursive: true });
    await fs.writeFile(path.join(dist, "requirements.txt"), "distpkg==1.0.0\n");
    const deps = await discoverDependencies(tmpDir);
    expect(deps.some((d) => d.name === "distpkg")).toBe(false);
  });

  it("deduplicates identical dependencies across multiple manifests", async () => {
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "requests==2.28.0\n");
    const sub = path.join(tmpDir, "sub");
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(sub, "requirements.txt"), "requests==2.28.0\n");
    const deps = await discoverDependencies(tmpDir);
    const found = deps.filter((d) => d.name === "requests" && d.version === "2.28.0");
    expect(found).toHaveLength(1);
  });

  it("handles multiple ecosystems in same repo", async () => {
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "flask==2.3.0\n");
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "4.18.0" } })
    );
    await fs.writeFile(path.join(tmpDir, "go.mod"), 'module example\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0\n');
    const deps = await discoverDependencies(tmpDir);
    const ecosystems = new Set(deps.map((d) => d.ecosystem));
    expect(ecosystems.has("PyPI")).toBe(true);
    expect(ecosystems.has("npm")).toBe(true);
    expect(ecosystems.has("Go")).toBe(true);
  });
  });
});
