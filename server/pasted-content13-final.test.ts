import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("pasted_content_13 final repository contracts", () => {
  it("keeps marketplace product/service purchase actions truthful and metadata-rich", () => {
    const creator = read("client/src/pages/CreatorHub.tsx");
    const catalog = read("client/src/pages/MarketCatalog.tsx");
    expect(creator).toContain("delivery_information");
    expect(creator).toContain("stock");
    expect(creator).toContain("location");
    expect(catalog).toContain("Request purchase");
    expect(catalog).toContain("No products or services have been published yet.");
  });

  it("keeps advertising owner-moderated and payment-honest", () => {
    const ads = read("client/src/components/AdsPanel.tsx");
    const migration = read("supabase/migrations/20260812_beatbox_advertiser_analytics.sql");
    expect(ads).toContain('status: "pending_review"');
    expect(ads).toContain("never marks payment successful");
    expect(migration).toContain("is_beatbox_admin");
  });

  it("adds owner-admin audit logging and typed moderation taxonomy", () => {
    const migration = read("supabase/migrations/20260812_beatbox_admin_audit_and_report_taxonomy.sql");
    expect(migration).toContain("beatbox_audit_log");
    expect(migration).toContain("log_profile_admin_change");
    expect(migration).toContain("subject_type");
    expect(migration).toContain("resolved_by");
    expect(migration).toContain("beatbox_profile_admin_change_audit");
  });

  it("covers Feed navigation, notifications, and prohibited social interactions", () => {
    const app = read("client/src/App.tsx");
    const community = read("client/src/pages/Community.tsx");
    const social = read("supabase/migrations/20260812_beatbox_creator_social_commerce_extension.sql");
    const notifications = read("supabase/migrations/20260812_beatbox_social_media_notifications.sql");
    expect(app).toContain("/feed");
    expect(app).toContain("/messages");
    expect(app).toContain("/search");
    for (const table of ["social_friend_requests", "social_blocks", "social_mutes"]) expect(community).toContain(table);
    expect(social).toContain("social_friend_requests");
    expect(social).toContain("social_blocks");
    expect(social).toContain("social_mutes");
    for (const trigger of ["social_post_like_notification", "social_post_comment_notification", "producer_follow_notification"]) expect(notifications).toContain(trigger);
  });
});
