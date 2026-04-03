import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 30000,
  },
});
