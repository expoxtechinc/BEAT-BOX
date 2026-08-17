import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("BeatBox production readiness contracts", () => {
  it("keeps public discovery aliases and route-aware metadata wired", () => {
    const app = read("client/src/App.tsx");
    const catalog = read("client/src/pages/MarketCatalog.tsx");
    const meta = read("client/src/hooks/usePageMeta.ts");
    for (const route of ["/feed", "/community", "/discover", "/categories", "/trending", "/new-releases", "/free-downloads", "/paid-content", "/products"]) expect(app).toContain(route);
    expect(catalog).toContain("content_items");
    expect(meta).toContain("canonical");
  });

  it("keeps social persistence, secure media, and moderation actions connected", () => {
    const community = read("client/src/pages/Community.tsx");
    const comments = read("client/src/components/CommentThread.tsx");
    const actions = read("client/src/components/SocialActions.tsx");
    for (const table of ["social_posts", "social_post_likes", "social_reposts", "social_post_bookmarks", "producer_follows", "social_friend_requests", "social_blocks", "social_mutes", "reports"]) expect(community).toContain(table);
    expect(comments).toContain("social_post_comments");
    expect(actions).toContain("social_post_reactions");
    expect(community).toContain("getPublicUrl");
    expect(community).toContain("profiles!social_posts_author_id_fkey");
    expect(community).toContain("getFeedRange(page, FEED_PAGE_SIZE)");
    expect(community).toContain('.eq("status", "published")');
  });

  it("preserves pending manual-payment and entitlement-controlled fulfillment", () => {
    const catalog = read("client/src/pages/MarketCatalog.tsx");
    const studio = read("client/src/pages/CreatorHub.tsx");
    const download = read("supabase/functions/secure-download/index.ts");
    expect(studio).toContain('from("social_posts")');
    expect(studio).toContain("content_id: publishedContent.id");
    expect(studio).toContain("shareToFeed");
    expect(catalog).toContain('status: "pending"');
    expect(catalog).toContain("Payment remains pending");
    expect(studio).toContain("seller_payment_methods");
    expect(download).toContain("createSignedUrl");
    expect(download).toContain("entitlement");
  });

  it("keeps public creator profiles published-only and preserves marketplace routes", () => { const app = read("client/src/App.tsx"); const producer = read("client/src/pages/Producer.tsx"); expect(app).toContain('<Route path="/producers/:id" component={Producer} />'); expect(producer).toContain('get_public_sellers'); expect(producer).toContain("loadPublishedBeats"); expect(producer).toContain("No public beats yet."); expect(producer).not.toContain("content-masters"); expect(producer).not.toContain("payment-proofs"); });

  it("keeps the AI production smoke procedure checked in without embedding provider secrets", () => { const diagnosis = read("docs/PRODUCTION_AI_DIAGNOSIS.md"); expect(diagnosis).toContain("/api/trpc/ai.health"); expect(diagnosis).toContain("authenticated"); expect(diagnosis).toContain("ordered providers"); expect(diagnosis).not.toMatch(/AIza|gsk_|sk-or-v1|Bearer\s+[A-Za-z0-9_-]{20,}/); });

  it("keeps creator monetization and admin boundaries server/database backed", () => {
    const studio = read("client/src/pages/CreatorHub.tsx");
    const admin = read("client/src/pages/Dashboards.tsx");
    const serverTests = read("server/beatbox.security.test.ts");
    expect(studio).toContain("seller_earnings");
    expect(studio).toContain("advertiser");
    expect(admin).toContain("reports");
    expect(serverTests).toContain("admin");
  });
});
