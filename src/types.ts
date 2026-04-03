export interface Dependency {
  name: string;
  version: string;
  ecosystem: string;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export interface Vulnerability {
  id: string; // e.g. "CVE-2021-23337" or OSV ID
  aliases: string[]; // cross-references (CVE IDs if OSV ID is primary, etc.)
  summary: string;
  severity: Severity;
  cvssScore?: number;
  fixedVersions: string[];
  affectedVersions: string[];
  ecosystem: string;
  packageName: string;
  published?: string;
  modified?: string;
}

export interface AcceptedRisk {
  id: string; // UUID4
  cve_id: string;
  reason: string;
  expires_on: string; // ISO 8601 date string YYYY-MM-DD
  accepted_at: string; // ISO 8601 datetime
  accepted_by?: string; // optional git user
  severity_at_acceptance: Severity; // severity label when risk was accepted (snapshot, not live)
  cvss_score_at_acceptance?: number; // CVSS score when risk was accepted (snapshot, not live)
}

export interface AcceptedRiskWithStatus extends AcceptedRisk {
  isExpired: boolean;
  daysUntilExpiry: number; // negative means expired
}

export interface EnrichedCVE {
  cveId: string;
  // From NVD (may be absent if unavailable)
  nvd?: {
    cvssV3Vector?: string;
    cvssV3BaseScore?: number;
    cvssV3Severity?: string;
    cweIds: string[];
    references: string[];
  };
  // From CISA KEV
  kev?: {
    inKEV: boolean;
    dateAdded?: string;
    shortDescription?: string;
    requiredAction?: string;
    dueDate?: string;
  };
  // Availability metadata
  nvdAvailable: boolean;
  kevAvailable: boolean;
}

export interface CheckCvesResult {
  actionable: Array<Vulnerability & { displayNumber: number }>;
  suppressed: Array<{ cveId: string; acceptanceId: string; expiresOn: string }>;
  expired: Array<AcceptedRiskWithStatus & { vulnerability: Vulnerability }>;
  belowThresholdCount: number;
  totalFound: number;
  minSeverity: Severity;
}
