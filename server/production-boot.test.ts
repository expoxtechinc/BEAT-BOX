import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production boot resilience", () => {
  const supabaseSource = readFileSync(resolve(process.cwd(), "client/src/lib/supabase.ts"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
  const htmlSource = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
  const mainSource = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");

  it("does not hard-fail module import when Vercel Supabase variables are absent", () => {
    expect(supabaseSource).toContain("isSupabaseConfigured");
    expect(supabaseSource).toContain('https://placeholder.supabase.co');
    expect(supabaseSource).not.toContain('throw new Error("BeatBox requires VITE_SUPABASE_URL');
  });

  it("does not leave unresolved optional analytics placeholders in the production HTML", () => {
    expect(htmlSource).not.toContain("%VITE_ANALYTICS_ENDPOINT%");
    expect(htmlSource).not.toContain("%VITE_ANALYTICS_WEBSITE_ID%");
    expect(mainSource).toContain("analyticsEndpoint && analyticsWebsiteId");
  });

  it("renders an actionable setup notice without blocking public routes", () => {
    expect(appSource).toContain("supabaseConfigurationMessage");
    expect(appSource).toContain('role="status"');
    expect(appSource).toContain("<Router />");
  });
});
