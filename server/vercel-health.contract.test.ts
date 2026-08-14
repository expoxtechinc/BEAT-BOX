import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Vercel health probe contract", () => {
  const healthEntrypoint = readFileSync(resolve(process.cwd(), "api/health.ts"), "utf8");
  const appEntrypoint = readFileSync(resolve(process.cwd(), "server/vercel-api-entry.ts"), "utf8");
  const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));

  it("keeps Gemini and Supabase reachability checks server-side and credential-safe", () => {
    expect(healthEntrypoint).toContain("process.env.GEMINI_API_KEY");
    expect(healthEntrypoint).not.toContain("process.env.VITE_GEMINI_API_KEY");
    expect(healthEntrypoint).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(healthEntrypoint).toContain("Cache-Control");
    expect(healthEntrypoint).toContain("type VercelResponseLike");
    expect(healthEntrypoint).toContain("res: VercelResponseLike");
  });

  it("isolates health from the full application while prebundling non-health server modules", () => {
    expect(healthEntrypoint).not.toContain("server/_core/app");
    expect(appEntrypoint).toContain('import { createApp } from "./_core/app"');
    expect(appEntrypoint).not.toContain('import("./_core/app")');
    expect(packageJson).toContain("esbuild server/vercel-api-entry.ts");
    expect(packageJson).toContain("--outfile=api/index.js");
  });

  it("serves filesystem functions before preserving fallback API paths and the SPA fallback", () => {
    expect(vercelConfig.routes).toEqual([
      { handle: "filesystem" },
      { src: "/api/(?<apiPath>.*)", dest: "/api/index?__beatbox_path=$apiPath" },
      { src: "/(.*)", dest: "/index.html" },
    ]);
    expect(appEntrypoint).toContain("__beatbox_path");
    expect(appEntrypoint).toContain("req.url =");
  });
});
