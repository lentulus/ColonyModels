import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // Test runs always use in-memory SQLite — separate from any local
      // ./colonymodels.db file the dev server might have created.
      DB_URL: ":memory:",
    },
  },
});
