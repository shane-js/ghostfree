import { describe, it, expect } from "vitest";
import { parsePomXml, parseBuildGradle } from "../../src/parsers/java";
import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (sub: string) => readFileSync(join(__dirname, "../fixtures", sub), "utf8");

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const xmlParse = (s: string) => xmlParser.parse(s) as unknown;

describe("Version specifier/range handling", () => {
  describe("parsePomXml", () => {
    it("vrc-inclusive-range — extracts lower bound from [1.0,2.0)", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>[1.0,2.0)</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "1.0", ecosystem: "Maven" }); // vrhp-extract-lower
    });

    it("vrc-inclusive-range — extracts lower bound from [2.0,2.0]", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>[2.0,2.0]</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "2.0", ecosystem: "Maven" }); // vrhp-extract-lower
    });

    it("vrc-upper-bound-only — skips [,1.0], no lower bound", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>[,1.0]</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-range — skips (4.1.3,), true minimum unknown", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>(4.1.3,)</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-range — skips (1.0,2.0), true minimum unknown", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>(1.0,2.0)</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-prerelease — preserves SNAPSHOT version", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>1.0.0-SNAPSHOT</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "1.0.0-SNAPSHOT", ecosystem: "Maven" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves classifier tag -jre", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.google.guava</groupId><artifactId>guava</artifactId><version>32.1.2-jre</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toContainEqual({ name: "com.google.guava:guava", version: "32.1.2-jre", ecosystem: "Maven" }); // vrhp-passthrough
    });

    it("vrc-exact — passes through exact version", () => {
      const xml = `<project><dependencies>
        <dependency><groupId>com.example</groupId><artifactId>lib</artifactId><version>2.28.2</version></dependency>
      </dependencies></project>`;
      const deps = parsePomXml(xml, xmlParse);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "2.28.2", ecosystem: "Maven" }); // vrhp-passthrough
    });
  });

  describe("parseBuildGradle", () => {
    it("vrc-inclusive-range — extracts lower bound from [1.0,2.0)", () => {
      const content = `dependencies {\n    implementation("com.example:lib:[1.0,2.0)")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "1.0", ecosystem: "Maven" }); // vrhp-extract-lower
    });

    it("vrc-exclusive-range — skips (4.1.3,), true minimum unknown", () => {
      const content = `dependencies {\n    implementation("com.example:lib:(4.1.3,)")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-exclusive-range — skips (1.0,2.0), true minimum unknown", () => {
      const content = `dependencies {\n    implementation("com.example:lib:(1.0,2.0)")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-upper-bound-only — skips [,1.0], no lower bound", () => {
      const content = `dependencies {\n    implementation("com.example:lib:[,1.0]")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toHaveLength(0); // vrhp-skip
    });

    it("vrc-prerelease — preserves prerelease tag", () => {
      const content = `dependencies {\n    implementation("com.example:lib:1.0.0-beta")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "1.0.0-beta", ecosystem: "Maven" }); // vrhp-passthrough
    });

    it("vrc-prerelease — preserves SNAPSHOT tag", () => {
      const content = `dependencies {\n    implementation("com.example:lib:1.0.0-SNAPSHOT")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "1.0.0-SNAPSHOT", ecosystem: "Maven" }); // vrhp-passthrough
    });

    it("vrc-exact — passes through exact version", () => {
      const content = `dependencies {\n    implementation("com.example:lib:2.15.2")\n}\n`;
      const deps = parseBuildGradle(content);
      expect(deps).toContainEqual({ name: "com.example:lib", version: "2.15.2", ecosystem: "Maven" }); // vrhp-passthrough
    });
  });
});

describe("parsePomXml", () => {
  it("parses all version formats from fixture", () => {
    const deps = parsePomXml(fixture("java/pom.xml"), xmlParse);
    // vrc-exact → vrhp-passthrough
    expect(deps).toContainEqual({ name: "org.springframework:spring-core", version: "6.0.11", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "junit:junit", version: "4.13.2", ecosystem: "Maven" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "com.example:snapshot-lib", version: "1.0.0-SNAPSHOT", ecosystem: "Maven" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "com.google.guava:guava", version: "32.1.2-jre", ecosystem: "Maven" });
    // vrc-inclusive-range → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "com.example:interval-lib", version: "1.0", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "com.example:interval-inclusive", version: "1.5", ecosystem: "Maven" });
  });

  it("skips vrhp-skip entries and property placeholders from fixture", () => {
    const deps = parsePomXml(fixture("java/pom.xml"), xmlParse);
    const names = deps.map((d) => d.name);
    // vrc-property-placeholder → vrhp-skip
    expect(names).not.toContain("com.fasterxml.jackson.core:jackson-databind");
    // vrc-exclusive-range → vrhp-skip
    expect(names).not.toContain("com.example:exclusive-lower");
    // vrc-upper-bound-only → vrhp-skip
    expect(names).not.toContain("com.example:upper-only");
    // vrc-exclusive-range → vrhp-skip
    expect(names).not.toContain("com.example:exclusive-both");
  });

  it("returns empty on invalid XML", () => {
    expect(parsePomXml("<broken>", xmlParse)).toHaveLength(0);
  });
});

describe("parseBuildGradle", () => {
  it("parses Groovy DSL build.gradle from fixture", () => {
    const deps = parseBuildGradle(fixture("java/build.gradle"));
    expect(deps).toContainEqual({ name: "com.google.guava:guava", version: "32.1.2-jre", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "org.apache.commons:commons-lang3", version: "3.12.0", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "com.fasterxml.jackson.core:jackson-databind", version: "2.15.2", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "org.junit.jupiter:junit-jupiter", version: "5.10.0", ecosystem: "Maven" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "com.example:snapshot-lib", version: "1.0.0-SNAPSHOT", ecosystem: "Maven" });
    // vrc-inclusive-range → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "com.example:interval-lib", version: "1.0", ecosystem: "Maven" });
  });

  it("skips vrhp-skip entries from Groovy DSL fixture", () => {
    const deps = parseBuildGradle(fixture("java/build.gradle"));
    const names = deps.map((d) => d.name);
    expect(names).not.toContain("com.example:exclusive-lower");
    expect(names).not.toContain("com.example:upper-only");
    expect(names).not.toContain("com.example:exclusive-both");
  });

  it("parses Kotlin DSL build.gradle.kts from fixture", () => {
    const deps = parseBuildGradle(fixture("java/build.gradle.kts"));
    expect(deps).toContainEqual({ name: "com.google.guava:guava", version: "32.1.2-jre", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "org.apache.commons:commons-lang3", version: "3.12.0", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "com.fasterxml.jackson.core:jackson-databind", version: "2.15.2", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "org.junit.jupiter:junit-jupiter", version: "5.10.0", ecosystem: "Maven" });
    // vrc-prerelease → vrhp-passthrough
    expect(deps).toContainEqual({ name: "com.example:snapshot-lib", version: "1.0.0-SNAPSHOT", ecosystem: "Maven" });
    // vrc-inclusive-range → vrhp-extract-lower
    expect(deps).toContainEqual({ name: "com.example:interval-lib", version: "1.0", ecosystem: "Maven" });
  });

  it("skips vrhp-skip entries from Kotlin DSL fixture", () => {
    const deps = parseBuildGradle(fixture("java/build.gradle.kts"));
    const names = deps.map((d) => d.name);
    expect(names).not.toContain("com.example:exclusive-lower");
    expect(names).not.toContain("com.example:upper-only");
    expect(names).not.toContain("com.example:exclusive-both");
  });

  it("parses implementation and compile declarations (inline)", () => {
    const content = `
dependencies {
    implementation("com.google.guava:guava:32.1.2-jre")
    compile 'org.apache.commons:commons-lang3:3.12.0'
    testImplementation("junit:junit:4.13.2")
}
`;
    const deps = parseBuildGradle(content);
    expect(deps).toContainEqual({ name: "com.google.guava:guava", version: "32.1.2-jre", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "org.apache.commons:commons-lang3", version: "3.12.0", ecosystem: "Maven" });
    expect(deps).toContainEqual({ name: "junit:junit", version: "4.13.2", ecosystem: "Maven" });
  });
});
