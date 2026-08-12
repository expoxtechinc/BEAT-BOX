import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("expanded profile metadata contract", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboards.tsx"), "utf8");
  const model = readFileSync(resolve(process.cwd(), "client/src/lib/models.ts"), "utf8");
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260812_beatbox_platform_expansion.sql"), "utf8");

  it("exposes the requested editable metadata fields", () => {
    for (const field of ["city", "website_url", "profession", "education", "interests"]) {
      expect(source).toContain(`${field}:`);
      expect(model).toContain(`${field}?`);
      expect(migration).toContain(`add column if not exists ${field}`);
    }
  });

  it("keeps profile metadata writes scoped to the authenticated user", () => {
    expect(source).toContain('supabase.from("profiles").update');
    expect(source).toContain('.eq("id",user.id)');
    expect(source).toContain('supabase.rpc("update_self_profile"');
  });
});
