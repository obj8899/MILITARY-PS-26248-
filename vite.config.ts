import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Production-only Content-Security-Policy (dev server needs inline HMR scripts and websockets).
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const cspPlugin = {
  name: "sudarshan-csp",
  apply: "build" as const,
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" as const }],
};

export default defineConfig({
  plugins: [react(), cspPlugin],
  build: { target: "es2020" },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "tests/**/*.e2e.spec.ts"],
  },
});
