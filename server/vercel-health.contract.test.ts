import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Vercel health probe contract", () => {
  const entrypoint = readFileSync(resolve(process.cwd(), "api/index.ts"), "utf8");
  const catchAll = readFileSync(resolve(process.cwd(), "api/[...path].ts"), "utf8");
  const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

  it("keeps Gemini and Supabase reachability checks server-side and credential-safe", () => {
    expect(entrypoint).toContain('path === "/api/health"');
    expect(entrypoint).toContain("process.env.GEMINI_API_KEY");
    expect(entrypoint).not.toContain("process.env.VITE_GEMINI_API_KEY");
    expect(entrypoint).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(entrypoint).toContain("Cache-Control");
  });

  it("defers full application imports until non-health requests", () => {
    expect(entrypoint).toContain('import("../server/_core/app")');
    expect(entrypoint).not.toContain('import { createApp } from "../server/_core/app"');
  });

  it("lets the Vercel file system resolve API paths before the SPA fallback", () => {
    expect(catchAll).toContain('export { default } from "./index"');
    expect(vercelConfig.routes).toEqual([
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ]);
  });
});
