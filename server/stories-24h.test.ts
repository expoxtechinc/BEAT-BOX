import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("24-hour Story and AI release", () => {
  it("uses privacy-aware active Story access and a 24-hour expiry boundary", () => {
    const migration = read("supabase/migrations/20260813_beatbox_stories_24h_audio.sql");
    expect(migration).toContain("expires_at timestamptz not null default (now() + interval '24 hours')");
    expect(migration).toContain("social_post_visible_to(auth.uid(), author_id, audience)");
    expect(migration).toContain("beatbox_story_views");
    expect(migration).toContain("beatbox_story_reactions");
    expect(migration).toContain("expire_beatbox_stories");
  });

  it("keeps Story media private, signs access, and enables sound after opening", () => {
    const rail = read("client/src/components/StoryRail.tsx");
    const viewer = read("client/src/components/StoryViewer.tsx");
    expect(rail).toContain('from("story-media").createSignedUrls');
    expect(rail).toContain('bucket: "story-media"');
    expect(viewer).toContain("media.muted = false");
    expect(viewer).toContain("Tap for sound");
    expect(viewer).not.toContain(" muted loop playsInline");
  });

  it("protects the cleanup route as an idempotent cron callback", () => {
    const cleanup = read("server/storyExpiryCleanup.ts");
    const server = read("server/_core/app.ts");
    expect(cleanup).toContain('if (!user.isCron || !user.taskUid)');
    expect(cleanup).toContain('rpc("expire_beatbox_stories")');
    expect(cleanup).toContain('from("story-media").remove(paths)');
    expect(server).toContain('app.post("/api/scheduled/expire-stories", runStoryExpiryCleanup)');
  });

  it("keeps Gemini server-only rather than reading a VITE browser key", () => {
    const router = read("server/aiRouter.ts");
    expect(router).toContain("process.env.GEMINI_API_KEY");
    expect(router).not.toContain("VITE_GEMINI_API_KEY");
  });
});
