import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:5176",
    headless: true,
    viewport: { width: 1366, height: 768 },
    launchOptions: {
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5176",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
