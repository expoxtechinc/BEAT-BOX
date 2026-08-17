import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const community = readFileSync(resolve(process.cwd(), "client/src/pages/Community.tsx"), "utf8");
const styles = [
  readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8"),
  readFileSync(resolve(process.cwd(), "client/src/styles/community.css"), "utf8"),
].join("\n");

 describe("public Feed media and discovery contracts", () => {
  it("renders public image lightbox and inline audio/video states with load-error feedback", () => {
    expect(community).toContain("feed-lightbox");
    expect(community).toContain("community-post__image-button");
    expect(community).toContain("<video");
    expect(community).toContain("Play public video");
    expect(community).toContain("AudioPreview");
    expect(community).toContain("One or more public attachments could not be loaded.");
    expect(styles).toContain(".feed-lightbox");
    expect(styles).toContain(".community-post__media");
  });

  it("renders typed published content references without selecting protected originals", () => {
    expect(community).toContain('select("id,title,content_type,price,currency,access_mode,description,slug,cover_path")');
    expect(community).toContain('.eq("status", "published")');
    expect(community).toContain("feed-content-card");
    expect(community).not.toContain("master_path");
    expect(community).not.toContain("payment-proof");
  });

  it("searches published marketplace items, active creators, and published posts", () => {
    expect(community).toContain('from("content_items")');
    expect(community).toContain('from("profiles")');
    expect(community).toContain('from("social_posts")');
    expect(community).toContain("display_name.ilike");
    expect(community).toContain("/feed?post=");
    expect(community).toContain("/creators/");
  });
});
