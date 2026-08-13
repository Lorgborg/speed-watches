import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    // Forking a process per test file crashes on Windows (VirtualAlloc failure).
    // Running all files in one worker is plenty for this small suite.
    fileParallelism: false,
  },
})
