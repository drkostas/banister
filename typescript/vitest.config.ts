import { defineConfig } from "vitest/config";

// The scipy-parity fit over real data takes about a minute (two in CI); it runs as its own job
// (`npm run test:parity`) so the unit suite stays a few hundred milliseconds. PARITY=1 includes it.
const parity = process.env.PARITY === "1";

export default defineConfig({
  test: {
    include: parity ? ["tests/parity/**/*.test.ts"] : ["tests/**/*.test.ts"],
    exclude: parity ? [] : ["tests/parity/**", "**/node_modules/**"],
    testTimeout: parity ? 300_000 : 5_000,
  },
});
