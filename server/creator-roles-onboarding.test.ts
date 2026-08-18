import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("creator roles and onboarding source contracts", () => {
  it("persists creator identity with additive RLS-safe Supabase schema", () => {
    const migration = read("supabase/migrations/20260818_beatbox_creator_roles_onboarding.sql");
    expect(migration).toContain("creator_roles");
    expect(migration).toContain("primary_creator_role");
    expect(migration).toContain("creator_onboarding_completed");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
  });

  it("exposes the role taxonomy in shared profile types and onboarding UI", () => {
    const models = read("client/src/lib/models.ts");
    const onboarding = read("client/src/components/CreatorRoleOnboarding.tsx");
    expect(models).toContain("artist");
    expect(models).toContain("producer");
    expect(models).toContain("creator_roles");
    expect(onboarding).toContain("Artist");
    expect(onboarding).toContain("Producer");
    expect(onboarding).toContain("Listener");
    expect(onboarding).toContain("creator_identity");
  });

  it("gates Creator Hub by creator identity and narrows publishing types by role", () => {
    const hub = read("client/src/pages/CreatorHub.tsx");
    expect(hub).toContain("creator_roles");
    expect(hub).toContain("primary_creator_role");
    expect(hub).toContain("Choose your BeatBox creator identity first");
    expect(hub).toContain("creatorRoles.some");
    expect(hub).toContain("Publish songs, releases, artwork");
    expect(hub).toContain('creatorRoles.some(role => ["producer", "creator"].includes(role))');
  });

  it("keeps onboarding integrated with the existing Profile settings flow", () => {
    const profile = read("client/src/pages/Profile.tsx");
    expect(profile).toContain("CreatorRoleOnboarding");
    expect(profile).toContain("creator_roles");
  });
});
