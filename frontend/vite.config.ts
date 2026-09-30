import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In development the ui runs on its own port and forwards /api to the backend.
const backend = process.env.VITE_BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": backend },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
