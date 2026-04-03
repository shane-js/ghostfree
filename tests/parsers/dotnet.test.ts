import { describe, it, expect } from "vitest";
import { parseCsproj, parsePackagesConfig } from "../../src/parsers/dotnet";
import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) => readFileSync(join(__dirname, "../fixtures", sub), "utf8");

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const xmlParse = (s: string) => xmlParser.parse(s) as unknown;

describe("Version specifier/range handling", () => {
  describe("parseCsproj", () => {
    it("vrc-inclusive-range — extracts lower bound from [1.0,2.0)", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="[1.0,2.0)" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "1.0", ecosystem: "NuGet" }); // vrhp-extract-lower
    });

    it("vrc-inclusive-range — extracts lower bound from [1.0,2.0]", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="[1.0,2.0]" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "1.0", ecosystem: "NuGet" }); // vrhp-extract-lower
    });

    it("vrc-inclusive-range — extracts lower bound from [2.0,2.0]", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="[2.0,2.0]" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "2.0", ecosystem: "NuGet" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips [,1.0], no lower bound", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="[,1.0]" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-range — skips (4.1.3,), true minimum unknown", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="(4.1.3,)" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-range — skips (1.0,2.0), true minimum unknown", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="(1.0,2.0)" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-upper-bound-only — skips (,1.0], no lower bound", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="(,1.0]" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-upper-bound-only — skips (,1.0), no lower bound", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="(,1.0)" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-wildcard — expands 6.* to lower bound 6.0", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="6.*" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "6.0", ecosystem: "NuGet" }); // vrhp-extract-lower
    });

    it("vrc-wildcard — expands 6.0.* to lower bound 6.0.0", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="6.0.*" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "6.0.0", ecosystem: "NuGet" }); // vrhp-extract-lower
    });

    it("vrc-exact — passes through bare version 6.1", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="6.1" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "6.1", ecosystem: "NuGet" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="1.0.0-beta" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "1.0.0-beta", ecosystem: "NuGet" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves dot-separated identifier", () => {
      const xml = `<Project><ItemGroup>
        <PackageReference Include="Example" Version="9.0.0-preview.1" />
      </ItemGroup></Project>`;
      const deps = parseCsproj(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "9.0.0-preview.1", ecosystem: "NuGet" }); // vrhp-passthrough
    });
  });

  describe("parsePackagesConfig", () => {
    it("vrc-exact — passes through exact pinned version", () => {
      const xml = `<?xml version="1.0"?><packages>
        <package id="Example" version="13.0.3" />
      </packages>`;
      const deps = parsePackagesConfig(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "13.0.3", ecosystem: "NuGet" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const xml = `<?xml version="1.0"?><packages>
        <package id="Example" version="5.0.0-beta.1" />
      </packages>`;
      const deps = parsePackagesConfig(xml, xmlParse);
      expect(deps).toContainEqual({ name: "Example", version: "5.0.0-beta.1", ecosystem: "NuGet" }); // vrhp-passthrough
    });
  });
});

describe("parseCsproj", () => {
  it("parses all version formats from fixture", () => {
    const deps = parseCsproj(fixture("dotnet/MyApp.csproj"), xmlParse);
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "Newtonsoft.Json", version: "13.0.3", ecosystem: "NuGet" });
    expect(deps).toContainEqual({ name: "Microsoft.EntityFrameworkCore", version: "8.0.0", ecosystem: "NuGet" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "System.Text.Json", version: "9.0.0-preview.1", ecosystem: "NuGet" });
    // vrc-inclusive-range → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "Serilog", version: "3.0", ecosystem: "NuGet" });
    // vrc-inclusive-range → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "Dapper", version: "2.0", ecosystem: "NuGet" });
    // vrc-wildcard → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "AutoMapper", version: "6.0", ecosystem: "NuGet" });
    // vrc-wildcard → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "MediatR", version: "12.0.0", ecosystem: "NuGet" });
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "Swashbuckle.AspNetCore", version: "6.5.0", ecosystem: "NuGet" });
  });

  it("skips vrhp-skip entries from fixture", () => {
    const deps = parseCsproj(fixture("dotnet/MyApp.csproj"), xmlParse);
    const names = deps.map((d) => d.name);
    // vrc-exclusive-range → vrhp-skip
    expect(names).not.toContain("Moq");
    // vrc-exclusive-range → vrhp-skip
    expect(names).not.toContain("FluentValidation");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("Polly");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("Bogus");
  });

  it("returns empty on invalid XML", () => {
    expect(parseCsproj("<bad>", xmlParse)).toHaveLength(0);
  });
});

describe("parsePackagesConfig", () => {
  it("parses package elements from fixture", () => {
    const deps = parsePackagesConfig(fixture("dotnet/packages.config"), xmlParse);
    expect(deps).toContainEqual({ name: "Newtonsoft.Json", version: "13.0.3", ecosystem: "NuGet" });
    expect(deps).toContainEqual({ name: "NUnit", version: "3.14.0", ecosystem: "NuGet" });
    expect(deps).toContainEqual({ name: "Dapper", version: "2.0.151", ecosystem: "NuGet" });
    expect(deps).toContainEqual({ name: "Serilog", version: "3.0.1", ecosystem: "NuGet" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "Castle.Core", version: "5.0.0-beta.1", ecosystem: "NuGet" });
  });

  it("returns empty on invalid XML", () => {
    expect(parsePackagesConfig("<bad>", xmlParse)).toHaveLength(0);
  });
});
