import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 15 * 60_000,
  reporter: [["list"]],
  use: { baseURL: process.env.OTTO_URL ?? "http://localhost:3000" },
});
