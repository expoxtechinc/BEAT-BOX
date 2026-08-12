import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("BeatBox Reels", () => {
  it("keeps public Reels media-first and uses persisted social interactions", () => {
    const source = read("client/src/pages/Reels.tsx");
    expect(source).toContain('eq("status", "published")');
    expect(source).toContain('from("social_post_likes")');
    expect(source).toContain('from("social_post_bookmarks")');
    expect(source).toContain('from("social_reposts")');
    expect(source).toContain('from("producer_follows")');
    expect(source).toContain("CommentThread");
    expect(source).toContain("autoPlay muted loop playsInline");
    expect(source).toContain("Paid marketplace masters remain protected");
  });

  it("does not embed provider secrets or fabricated interaction totals", () => {
    const source = read("client/src/pages/Reels.tsx");
    expect(source).not.toMatch(/AIza|gsk_|sk-or-|hf_/);
    expect(source).not.toMatch(/9999|123456/);
  });
});
