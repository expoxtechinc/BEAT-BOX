import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Vercel health probe contract", () => {
  const entrypoint = readFileSync(resolve(process.cwd(), "api/index.ts"), "utf8");
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

  it("preserves the original API path before the SPA fallback", () => {
    expect(vercelConfig.routes).toEqual([
      { src: "/api/(?<apiPath>.*)", dest: "/api/index?__beatbox_path=$apiPath" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ]);
    expect(entrypoint).toContain("__beatbox_path");
    expect(entrypoint).toContain("req.url =");
  });
});
