import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const profile = () => readFileSync(resolve(root, "client/src/pages/Profile.tsx"), "utf8");
const reels = () => readFileSync(resolve(root, "client/src/pages/Reels.tsx"), "utf8");
const css = () => readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("profile and Reel creator upgrade", () => {
  it("keeps avatar uploads scoped to the authenticated user and uses the public avatar bucket", () => {
    const source = profile();
    expect(source).toContain('uploadResumable({ bucket: "avatars"');
    expect(source).toContain('`${user.id}/');
    expect(source).toContain('supabase.from("profiles").update({ avatar_url: publicUrl })');
    expect(source).toContain('supabase.from("content_bookmarks")');
  });

  it("publishes only public Reel video media and creates a social reel record", () => {
    const source = reels();
    expect(source).toContain('uploadResumable({ bucket: "social-media"');
    expect(source).toContain('media_type: "video"');
    expect(source).toContain('supabase.from("social_reels").insert');
    expect(source).not.toContain('content-masters');
  });

  it("implements browser-safe muted playback and vertical snap navigation", () => {
    const source = reels();
    const styles = css();
    expect(source).toContain("playsInline");
    expect(source).toContain("muted={muted}");
    expect(source).toContain('scrollIntoView({ behavior: "smooth"');
    expect(styles).toContain("scroll-snap-type:y mandatory");
    expect(styles).toContain("scroll-snap-align:start");
  });
});
