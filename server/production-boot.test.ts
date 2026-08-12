import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production boot resilience", () => {
  const supabaseSource = readFileSync(resolve(process.cwd(), "client/src/lib/supabase.ts"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

  it("does not hard-fail module import when Vercel Supabase variables are absent", () => {
    expect(supabaseSource).toContain("isSupabaseConfigured");
    expect(supabaseSource).toContain('https://placeholder.supabase.co');
    expect(supabaseSource).not.toContain('throw new Error("BeatBox requires VITE_SUPABASE_URL');
  });

  it("renders an actionable setup notice without blocking public routes", () => {
    expect(appSource).toContain("supabaseConfigurationMessage");
    expect(appSource).toContain('role="status"');
    expect(appSource).toContain("<Router />");
  });
});
