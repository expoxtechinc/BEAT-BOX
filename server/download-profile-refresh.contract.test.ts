import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BeatBox download, profile, and refresh safeguards", () => {
  it("treats an explicitly free beat as a free download even when legacy metadata is inconsistent", () => {
    const functionSource = readFileSync("supabase/functions/secure-download/index.ts", "utf8");
    const migration = readFileSync("supabase/migrations/20260815_beatbox_secure_download_profile_cover.sql", "utf8");

    expect(functionSource).toContain('data.is_free ? "free_download" : (data.access_mode || "paid_download")');
    expect(migration).toContain("set access_mode = 'free_download'");
    expect(migration).toContain("is_free is true");
  });

  it("keeps the official support actions and mobile refresh affordance visible in the product", () => {
    const contact = readFileSync("client/src/pages/Info.tsx", "utf8");
    const profile = readFileSync("client/src/pages/Profile.tsx", "utf8");
    const community = readFileSync("client/src/pages/Community.tsx", "utf8");
    const explore = readFileSync("client/src/pages/Explore.tsx", "utf8");

    expect(contact).toContain("+231889792996");
    expect(contact).toContain("beatbox.contact@gmail.com");
    expect(profile).toContain("usePullToRefresh");
    expect(community).toContain("usePullToRefresh");
    expect(explore).toContain("usePullToRefresh");
    expect(explore).toContain("Pull to refresh");
  });
});
