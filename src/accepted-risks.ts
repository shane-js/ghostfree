import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import type { AcceptedRisk, AcceptedRiskWithStatus, Severity } from "./types.js";

const DEFAULT_DIR = ".ghostfree";
const DEFAULT_FILENAME = "accepted.yml";
const MAX_EXPIRY_YEARS = 1;

/** Resolve the .ghostfree directory, honoring GHOSTFREE_DIR if set */
function resolveGhostfreeDir(repoPath: string): string {
  return process.env["GHOSTFREE_DIR"] ?? path.join(repoPath, DEFAULT_DIR);
}

/** Resolve the path to accepted.yml */
export function resolveAcceptedPath(repoPath: string): string {
  return path.join(resolveGhostfreeDir(repoPath), DEFAULT_FILENAME);
}

/** Load accepted risks from YAML. Returns [] if file doesn't exist. */
export async function loadAcceptedRisks(repoPath: string): Promise<AcceptedRisk[]> {
  const filePath = resolveAcceptedPath(repoPath);
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = yaml.load(content) as { accepted_risks?: AcceptedRisk[] } | null;
    return parsed?.accepted_risks ?? [];
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") return [];
    throw err;
  }
}

/** Save accepted risks back to YAML, creating the directory if needed.
 *  Returns a guidance message if this is the first creation. */
export async function saveAcceptedRisks(
  repoPath: string,
  risks: AcceptedRisk[]
): Promise<{ message?: string }> {
  const filePath = resolveAcceptedPath(repoPath);
  const dir = path.dirname(filePath);
  const isFirstCreation = !(await fileExists(filePath));

  await fs.mkdir(dir, { recursive: true });
  const content = yaml.dump({ accepted_risks: risks }, { indent: 2, lineWidth: 120 });
  await fs.writeFile(filePath, content, "utf8");

  if (isFirstCreation && !process.env["GHOSTFREE_DIR"]) {
    return {
      message:
        `Created ${path.relative(repoPath, filePath)} in your repo root. ` +
        `Commit this file to share accepted risks with your team. ` +
        `Set the GHOSTFREE_DIR env var to use a custom directory.`,
    };
  }
  return {};
}

/** Accept a CVE risk, enforcing expiry rules */
export async function acceptRisk(
  repoPath: string,
  cveId: string,
  reason: string,
  expiresOn: string,
  confirmExtendedExpiry = false,
  severityAtAcceptance: Severity = "UNKNOWN",
  cvssScoreAtAcceptance?: number
): Promise<{ success: boolean; message: string; guidanceMessage?: string }> {
  if (!expiresOn) {
    return { success: false, message: "expires_on is required. Provide a date in YYYY-MM-DD format." };
  }

  const expiryDate = new Date(expiresOn);
  if (isNaN(expiryDate.getTime())) {
    return { success: false, message: `Invalid date format for expires_on: "${expiresOn}". Use YYYY-MM-DD.` };
  }

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + MAX_EXPIRY_YEARS);

  if (expiryDate <= now) {
    return { success: false, message: `expires_on "${expiresOn}" is already in the past.` };
  }

  if (expiryDate > oneYearFromNow && !confirmExtendedExpiry) {
    return {
      success: false,
      message:
        `⚠️ The requested expiry (${expiresOn}) is more than 1 year away. ` +
        `Extended acceptances require explicit confirmation. ` +
        `Call accept_risk again with confirm_extended_expiry=true to proceed.`,
    };
  }

  const existing = await loadAcceptedRisks(repoPath);
  const newRisk: AcceptedRisk = {
    id: crypto.randomUUID(),
    cve_id: cveId,
    reason,
    expires_on: expiresOn,
    accepted_at: now.toISOString(),
    severity_at_acceptance: severityAtAcceptance,
    ...(cvssScoreAtAcceptance != null ? { cvss_score_at_acceptance: cvssScoreAtAcceptance } : {}),
  };

  const { message: guidanceMessage } = await saveAcceptedRisks(repoPath, [...existing, newRisk]);
  return {
    success: true,
    message: `Accepted risk for ${cveId} until ${expiresOn}. Acceptance ID: ${newRisk.id}`,
    guidanceMessage,
  };
}

/** Remove an accepted risk by UUID */
export async function removeAcceptedRisk(
  repoPath: string,
  acceptanceId: string
): Promise<{ success: boolean; message: string }> {
  const existing = await loadAcceptedRisks(repoPath);
  const filtered = existing.filter((r) => r.id !== acceptanceId);

  if (filtered.length === existing.length) {
    return { success: false, message: `No accepted risk found with ID: ${acceptanceId}` };
  }

  await saveAcceptedRisks(repoPath, filtered);
  return { success: true, message: `Removed accepted risk ${acceptanceId}` };
}

/** List all accepted risks with computed expiry status */
export async function listAcceptedRisks(repoPath: string): Promise<AcceptedRiskWithStatus[]> {
  const risks = await loadAcceptedRisks(repoPath);
  const now = new Date();
  return risks.map((r) => {
    const expiry = new Date(r.expires_on);
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { ...r, isExpired: daysUntilExpiry < 0, daysUntilExpiry };
  });
}

// Helpers

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
