import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveAcceptedPath,
  loadAcceptedRisks,
  acceptRisk,
  removeAcceptedRisk,
  listAcceptedRisks,
} from "../src/accepted-risks.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ghostfree-test-"));
  delete process.env["GHOSTFREE_DIR"];
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env["GHOSTFREE_DIR"];
});

describe("resolveAcceptedPath", () => {
  it("uses GHOSTFREE_DIR env var when set", () => {
    const customDir = path.join(tmpDir, "custom");
    process.env["GHOSTFREE_DIR"] = customDir;
    expect(resolveAcceptedPath(tmpDir)).toBe(path.join(customDir, "accepted.yml"));
  });

  it("defaults to .ghostfree/accepted.yml in repo root", () => {
    const resolved = resolveAcceptedPath(tmpDir);
    expect(resolved).toBe(path.join(tmpDir, ".ghostfree", "accepted.yml"));
  });
});

describe("loadAcceptedRisks", () => {
  it("returns empty array when file does not exist", async () => {
    const risks = await loadAcceptedRisks(tmpDir);
    expect(risks).toHaveLength(0);
  });

  it("loads risks from an existing YAML file", async () => {
    const dir = path.join(tmpDir, ".ghostfree");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "accepted.yml"),
      `accepted_risks:\n  - id: "abc-123"\n    cve_id: "CVE-2021-1234"\n    reason: "test"\n    expires_on: "2099-01-01"\n    accepted_at: "2026-01-01T00:00:00.000Z"\n`
    );
    const risks = await loadAcceptedRisks(tmpDir);
    expect(risks).toHaveLength(1);
    expect(risks[0].cve_id).toBe("CVE-2021-1234");
  });
});

describe("acceptRisk", () => {
  const futureDate = "2099-01-01";
  const nearFuture = new Date();
  nearFuture.setMonth(nearFuture.getMonth() + 3);
  const nearFutureDate = nearFuture.toISOString().slice(0, 10);

  it("accepts a valid risk within 1 year", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "test reason", nearFutureDate);
    expect(result.success).toBe(true);
    expect(result.message).toContain("CVE-2021-1234");

    const risks = await loadAcceptedRisks(tmpDir);
    expect(risks).toHaveLength(1);
    expect(risks[0].reason).toBe("test reason");
    expect(risks[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("rejects when expires_on is missing", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", "");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expires_on is required");
  });

  it("rejects when expires_on is in the past", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", "2020-01-01");
    expect(result.success).toBe(false);
    expect(result.message).toContain("already in the past");
  });

  it("rejects >1 year expiry without confirmation", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", futureDate, false);
    expect(result.success).toBe(false);
    expect(result.message).toContain("more than 1 year");
  });

  it("accepts >1 year expiry with confirm_extended_expiry=true", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", futureDate, true);
    expect(result.success).toBe(true);
  });

  it("includes guidance message on first file creation", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", nearFutureDate);
    expect(result.success).toBe(true);
    expect(result.guidanceMessage).toContain("Commit this file");
  });

  it("does not include guidance message on subsequent writes", async () => {
    await acceptRisk(tmpDir, "CVE-2021-1234", "reason", nearFutureDate);
    const result2 = await acceptRisk(tmpDir, "CVE-2021-5678", "reason", nearFutureDate);
    expect(result2.guidanceMessage).toBeUndefined();
  });

  it("rejects invalid date format", async () => {
    const result = await acceptRisk(tmpDir, "CVE-2021-1234", "reason", "not-a-date");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid date format");
  });

  it("stores severity_at_acceptance and cvss_score_at_acceptance when provided", async () => {
    const nearFuture = new Date();
    nearFuture.setMonth(nearFuture.getMonth() + 3);
    const date = nearFuture.toISOString().slice(0, 10);

    const result = await acceptRisk(tmpDir, "CVE-2021-9999", "reason", date, false, "HIGH", 7.5);
    expect(result.success).toBe(true);

    const risks = await loadAcceptedRisks(tmpDir);
    expect(risks).toHaveLength(1);
    expect(risks[0].severity_at_acceptance).toBe("HIGH");
    expect(risks[0].cvss_score_at_acceptance).toBe(7.5);
  });

  it("omits cvss_score field when not provided but always has severity", async () => {
    const nearFuture = new Date();
    nearFuture.setMonth(nearFuture.getMonth() + 3);
    const date = nearFuture.toISOString().slice(0, 10);

    await acceptRisk(tmpDir, "CVE-2021-8888", "reason", date);
    const risks = await loadAcceptedRisks(tmpDir);
    expect(risks[0].severity_at_acceptance).toBe("UNKNOWN");
    expect(risks[0].cvss_score_at_acceptance).toBeUndefined();
  });
});

describe("removeAcceptedRisk", () => {
  it("removes an existing risk by UUID", async () => {
    const nearFuture = new Date();
    nearFuture.setMonth(nearFuture.getMonth() + 3);
    const date = nearFuture.toISOString().slice(0, 10);

    await acceptRisk(tmpDir, "CVE-2021-1234", "reason", date);
    const risks = await loadAcceptedRisks(tmpDir);
    const id = risks[0].id;

    const result = await removeAcceptedRisk(tmpDir, id);
    expect(result.success).toBe(true);

    const after = await loadAcceptedRisks(tmpDir);
    expect(after).toHaveLength(0);
  });

  it("returns success=false for unknown UUID", async () => {
    const result = await removeAcceptedRisk(tmpDir, "00000000-0000-4000-8000-000000000000");
    expect(result.success).toBe(false);
    expect(result.message).toContain("No accepted risk found");
  });
});

describe("listAcceptedRisks", () => {
  it("computes isExpired=true for past expiry dates", async () => {
    const dir = path.join(tmpDir, ".ghostfree");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "accepted.yml"),
      `accepted_risks:\n  - id: "abc-123"\n    cve_id: "CVE-2021-1234"\n    reason: "test"\n    expires_on: "2020-01-01"\n    accepted_at: "2019-01-01T00:00:00.000Z"\n`
    );
    const risks = await listAcceptedRisks(tmpDir);
    expect(risks[0].isExpired).toBe(true);
    expect(risks[0].daysUntilExpiry).toBeLessThan(0);
  });

  it("computes isExpired=false for future expiry dates", async () => {
    const nearFuture = new Date();
    nearFuture.setMonth(nearFuture.getMonth() + 3);
    const date = nearFuture.toISOString().slice(0, 10);

    await acceptRisk(tmpDir, "CVE-2021-1234", "reason", date);
    const risks = await listAcceptedRisks(tmpDir);
    expect(risks[0].isExpired).toBe(false);
    expect(risks[0].daysUntilExpiry).toBeGreaterThan(0);
  });

  it("includes severity snapshot fields in listed risks", async () => {
    const nearFuture = new Date();
    nearFuture.setMonth(nearFuture.getMonth() + 3);
    const date = nearFuture.toISOString().slice(0, 10);

    await acceptRisk(tmpDir, "CVE-2021-1234", "reason", date, false, "CRITICAL", 9.8);
    const risks = await listAcceptedRisks(tmpDir);
    expect(risks[0].severity_at_acceptance).toBe("CRITICAL");
    expect(risks[0].cvss_score_at_acceptance).toBe(9.8);
  });
});
