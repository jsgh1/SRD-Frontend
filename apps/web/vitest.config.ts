import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
      thresholds: {
        // Guard the initial tested surfaces while broad application coverage grows.
        "src/api.ts": { statements: 75, branches: 55, functions: 80, lines: 90, perFile: true },
        "src/ui.tsx": { statements: 55, branches: 70, functions: 55, lines: 60, perFile: true },
      },
    },
  },
});
