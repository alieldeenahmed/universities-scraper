import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    // several test files boot an embedded postgres at once, which is slow on a busy machine
    hookTimeout: 90_000,
  },
});
