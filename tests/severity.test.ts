import { describe, it, expect } from "vitest";
import { parseSeverity, resolveMinSeverity, meetsThreshold, sortBySeverity } from "../src/severity.js";
import type { Severity } from "../src/types.js";

describe("parseSeverity", () => {
  it("parses valid severity strings case-insensitively", () => {
    expect(parseSeverity("CRITICAL")).toBe("CRITICAL");
    expect(parseSeverity("high")).toBe("HIGH");
    expect(parseSeverity("Medium")).toBe("MEDIUM");
    expect(parseSeverity("low")).toBe("LOW");
  });

  it("returns UNKNOWN for unrecognized values", () => {
    expect(parseSeverity("NONE")).toBe("UNKNOWN");
    expect(parseSeverity("")).toBe("UNKNOWN");
    expect(parseSeverity(undefined)).toBe("UNKNOWN");
  });
});

describe("resolveMinSeverity", () => {
  it("uses override when provided", () => {
    expect(resolveMinSeverity("HIGH")).toBe("HIGH");
  });

  it("returns MEDIUM when no override", () => {
    expect(resolveMinSeverity()).toBe("MEDIUM");
  });
});

describe("meetsThreshold", () => {
  it("returns true when severity is at or above threshold", () => {
    expect(meetsThreshold("CRITICAL", "HIGH")).toBe(true);
    expect(meetsThreshold("HIGH", "HIGH")).toBe(true);
    expect(meetsThreshold("MEDIUM", "MEDIUM")).toBe(true);
    expect(meetsThreshold("CRITICAL", "LOW")).toBe(true);
  });

  it("returns false when severity is below threshold", () => {
    expect(meetsThreshold("LOW", "MEDIUM")).toBe(false);
    expect(meetsThreshold("MEDIUM", "HIGH")).toBe(false);
    expect(meetsThreshold("UNKNOWN", "LOW")).toBe(false);
  });
});

describe("sortBySeverity", () => {
  it("sorts by severity descending", () => {
    const items = [
      { id: "CVE-1", severity: "LOW" as Severity },
      { id: "CVE-2", severity: "CRITICAL" as Severity },
      { id: "CVE-3", severity: "HIGH" as Severity },
      { id: "CVE-4", severity: "MEDIUM" as Severity },
    ];
    const sorted = sortBySeverity(items);
    expect(sorted.map((i) => i.severity)).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
  });

  it("sorts alphabetically by ID as tiebreaker when no cvssScore", () => {
    const items = [
      { id: "CVE-2024-002", severity: "HIGH" as Severity },
      { id: "CVE-2024-001", severity: "HIGH" as Severity },
    ];
    const sorted = sortBySeverity(items);
    expect(sorted[0].id).toBe("CVE-2024-001");
  });

  it("sorts by cvssScore descending within same severity tier", () => {
    const items = [
      { id: "CVE-A", severity: "CRITICAL" as Severity, cvssScore: 9.1 },
      { id: "CVE-B", severity: "CRITICAL" as Severity, cvssScore: 9.8 },
      { id: "CVE-C", severity: "CRITICAL" as Severity, cvssScore: 9.8 },
    ];
    const sorted = sortBySeverity(items);
    expect(sorted[0].cvssScore).toBe(9.8);
    expect(sorted[1].cvssScore).toBe(9.8);
    expect(sorted[2].cvssScore).toBe(9.1);
    expect(sorted[2].id).toBe("CVE-A");
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "CVE-B", severity: "LOW" as Severity },
      { id: "CVE-A", severity: "CRITICAL" as Severity },
    ];
    const original = [...items];
    sortBySeverity(items);
    expect(items).toEqual(original);
  });
});
