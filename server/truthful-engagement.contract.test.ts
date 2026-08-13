import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("truthful engagement analytics", () => {
  it("uses daily-deduplicated, privacy-aware events before changing public counters", () => {
    const migration = read("supabase/migrations/20260813_beatbox_truthful_engagement_analytics.sql");
    expect(migration).toContain("unique (subject_type, subject_id, event_type, actor_id, event_day)");
    expect(migration).toContain("record_engagement_event");
    expect(migration).toContain("view_count integer");
    expect(migration).toContain("play_count = play_count");
    expect(migration).toContain("social_post_visible_to");
  });

  it("labels saves separately from persisted likes, views, plays, and comments", () => {
    const detail = read("client/src/pages/BeatDetail.tsx");
    const preview = read("client/src/components/AudioPreview.tsx");
    expect(detail).toContain("views");
    expect(detail).toContain("likes");
    expect(detail).toContain("comments");
    expect(detail).toContain("saves");
    expect(preview).toContain("recordEngagement");
  });

  it("routes Vercel API traffic through the server-only Express entrypoint", () => {
    const vercel = read("vercel.json");
    const api = read("server/vercel-api-entry.ts");
    const health = read("api/health.ts");
    const packageJson = read("package.json");
    expect(vercel).toContain('"dest": "/api/index?__beatbox_path=$apiPath"');
    expect(vercel).toContain('{ "handle": "filesystem" }');
    expect(api).toContain("createApp");
    expect(api).toContain("__beatbox_path");
    expect(api).not.toMatch(/import\("\.\/_core\/app"\)/);
    expect(packageJson).toContain("--outfile=api/index.js");
    expect(health).not.toMatch(/VITE_GEMINI_API_KEY/);
  });
});
