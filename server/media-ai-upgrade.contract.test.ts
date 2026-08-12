import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("BeatBox media and AI upgrade contracts", () => {
  it("prepares Reel media and persists a public thumbnail path", () => {
    const helper = read("client/src/lib/reelMedia.ts");
    const reels = read("client/src/pages/Reels.tsx");
    const migration = read("supabase/migrations/20260812_beatbox_reel_thumbnails.sql");
    expect(helper).toContain("prepareReelMedia");
    expect(helper).toContain("canvas.toBlob");
    expect(helper).toContain("MediaRecorder");
    expect(reels).toContain("prepareReelMedia(file");
    expect(reels).toContain('thumbnail_path: thumbnailPath');
    expect(reels).toContain('poster={thumbnailUrls[post.id]}');
    expect(migration).toContain("alter table if exists public.social_posts");
    expect(migration).toContain("thumbnail_path text");
  });

  it("keeps deployment request typing portable and feature entry points discoverable", () => {
    const cookies = read("server/_core/cookies.ts");
    const sdk = read("server/_core/sdk.ts");
    const routers = read("server/routers.ts");
    const producer = read("client/src/pages/Producer.tsx");
    const shell = read("client/src/components/MarketplaceShell.tsx");
    expect(cookies).toContain("CookieRequestLike");
    expect(cookies).not.toContain('from "express"');
    expect(sdk).toContain("authenticateRequest(req: CookieRequestLike)");
    expect(routers).toContain("clearCookie");
    expect(producer).toContain("/messages?to=");
    expect(producer).toContain("aria-label={`Message ${name}`}");
    expect(shell).toContain("/reels#reel-upload");
    expect(shell).toContain("Upload Reel");
  });

  it("keeps browser offline AI behavior explicit and credential-free", () => {
    const ai = read("client/src/pages/AI.tsx");
    const router = read("server/aiRouter.ts");
    expect(ai).toContain("navigator.onLine");
    expect(ai).toContain("Lite/offline mode");
    expect(ai).toContain("getCachedHelp");
    expect(ai).not.toContain("GEMINI_API_KEY");
    expect(router).toContain("configuredProviders");
    expect(router).toContain("process.env.GEMINI_API_KEY");
    expect(router).toContain("process.env.GROQ_API_KEY");
    expect(router).toContain("process.env.OPENROUTER_API_KEY");
    expect(router).not.toContain("console.log(process.env");
  });
});
