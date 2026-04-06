import { describe, it, expect } from "vitest";
import { resolvePreElicitSeverity } from "../../src/tools/check-cves.js";
import type { GhostFreeConfig } from "../../src/config.js";

// Helpers
const noConfig = async (): Promise<GhostFreeConfig> => ({});
const configWith = (severity: string): () => Promise<GhostFreeConfig> =>
  async () => ({ min_severity: severity as GhostFreeConfig["min_severity"] });
const noEnv = (_key: string): string | undefined => undefined;
const envWith = (val: string) => (_key: string) => val;

describe("check_cves tool", () => {
  describe("resolvePreElicitSeverity — resolution order", () => {
    it("returns tool arg when provided (highest priority)", async () => {
      const result = await resolvePreElicitSeverity("CRITICAL", envWith("HIGH"), configWith("LOW"));
      expect(result.severity).toBe("CRITICAL");
      expect(result.source).toContain("tool argument");
    });

    it("returns env var when no tool arg, even if config is set (env overrides config)", async () => {
      const result = await resolvePreElicitSeverity(undefined, envWith("HIGH"), configWith("LOW"));
      expect(result.severity).toBe("HIGH");
      expect(result.source).toContain("GHOSTFREE_MIN_SEVERITY");
    });

    it("returns config value when no tool arg and no env var", async () => {
      const result = await resolvePreElicitSeverity(undefined, noEnv, configWith("MEDIUM"));
      expect(result.severity).toBe("MEDIUM");
      expect(result.source).toContain("config file");
    });

    it("returns undefined when no source provides a value (falls through to elicit)", async () => {
      const result = await resolvePreElicitSeverity(undefined, noEnv, noConfig);
      expect(result.severity).toBeUndefined();
    });

    it("skips config UNKNOWN (treated as unset)", async () => {
      const result = await resolvePreElicitSeverity(undefined, noEnv, configWith("UNKNOWN"));
      expect(result.severity).toBeUndefined();
    });

    it("does not call readConfig when env var is present (short-circuits)", async () => {
      let configCalled = false;
      const trackingConfig = async (): Promise<GhostFreeConfig> => {
        configCalled = true;
        return { min_severity: "LOW" };
      };
      await resolvePreElicitSeverity(undefined, envWith("CRITICAL"), trackingConfig);
      expect(configCalled).toBe(false);
    });

    it("does not call readConfig when tool arg is present (short-circuits)", async () => {
      let configCalled = false;
      const trackingConfig = async (): Promise<GhostFreeConfig> => {
        configCalled = true;
        return { min_severity: "LOW" };
      };
      await resolvePreElicitSeverity("HIGH", noEnv, trackingConfig);
      expect(configCalled).toBe(false);
    });

    it("passes the correct env key to getEnv", async () => {
      const keys: string[] = [];
      const trackingEnv = (key: string): string | undefined => {
        keys.push(key);
        return undefined;
      };
      await resolvePreElicitSeverity(undefined, trackingEnv, noConfig);
      expect(keys).toContain("GHOSTFREE_MIN_SEVERITY");
    });
  });
});
