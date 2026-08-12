import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const community = readFileSync(`${root}/client/src/pages/Community.tsx`, "utf8");
const marketplace = readFileSync(`${root}/client/src/lib/marketplace.ts`, "utf8");
const producer = readFileSync(`${root}/client/src/pages/Producer.tsx`, "utf8");
const socialMigration = readFileSync(`${root}/supabase/migrations/20260812_beatbox_creator_social_commerce_extension.sql`, "utf8");
const securityMigration = readFileSync(`${root}/supabase/migrations/20260811_beatbox_security_and_marketplace.sql`, "utf8");
const notificationMigration = readFileSync(`${root}/supabase/migrations/20260812_beatbox_social_media_notifications.sql`, "utf8");
const contentEngagementMigration = readFileSync(`${root}/supabase/migrations/20260812_beatbox_content_engagement.sql`, "utf8");

function section(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

describe("social persistence and public-visibility contracts", () => {
  it("uses user-scoped, persisted actions for likes, saves, comments, reposts, follows, connections, moderation, and reports", () => {
    expect(community).toContain('from("social_post_likes")');
    expect(community).toContain('from("social_post_bookmarks")');
    expect(community).toContain('from("social_post_comments")');
    expect(community).toContain('from("social_reposts")');
    expect(community).toContain('from("producer_follows")');
    expect(community).toContain('from("social_friend_requests")');
    expect(community).toContain('from("social_blocks")');
    expect(community).toContain('from("social_mutes")');
    expect(community).toContain('from("reports")');
    expect(community).toContain('insert({ post_id: post.id, user_id: user.id, body: text.trim() })');
    expect(community).toContain('insert({ post_id: post.id, user_id: user.id });');
    expect(community).toContain('insert({ reporter_id: user.id, reason: reason.trim(), reported_post_id: post.id');
    expect(community).toContain('upsert({ sender_id: user.id, receiver_id: authorId, status: "pending" }');
    expect(socialMigration).toContain("auth.uid()");
    expect(securityMigration).toContain("auth.uid()");
  });

  it("supports reply persistence and preserves parent-child comment relationships", () => {
    const commentsStart = socialMigration.indexOf("create table if not exists public.social_post_comments");
    const commentsEnd = socialMigration.indexOf("create table if not exists", commentsStart + 1);
    const commentsSql = socialMigration.slice(commentsStart, commentsEnd < 0 ? socialMigration.length : commentsEnd);
    expect(commentsSql).toContain("parent_id uuid references public.social_post_comments(id)");
    expect(commentsSql).toContain("body text not null");
    expect(community).toContain('from("social_post_comments")');
  });

  it("maps share/repost and report persistence to durable database rows and moderation notifications", () => {
    expect(socialMigration).toContain("create table if not exists public.content_shares");
    expect(socialMigration).toContain("create table if not exists public.social_reposts");
    expect(socialMigration).toContain("reported_post_id uuid references public.social_posts");
    expect(community).toContain('from("social_reposts")');
    expect(community).toContain('from("reports")');
    expect(socialMigration).toContain("reported_post_id");
    expect(notificationMigration).toContain("social_post_like_notification");
    expect(notificationMigration).toContain("social_post_comment_notification");
    expect(notificationMigration).toContain("social_repost_notification");
    expect(contentEngagementMigration).toContain("create trigger social_post_comment_count");
    expect(contentEngagementMigration).toContain("create trigger social_repost_count");
  });

  it("prevents duplicate likes, saves, reposts, follows, blocks, and mutes at the database boundary", () => {
    for (const table of ["social_post_likes", "social_post_bookmarks", "social_reposts"]) {
      const tableStart = socialMigration.indexOf(`create table if not exists public.${table}`);
      const next = socialMigration.indexOf("create table if not exists", tableStart + 1);
      const tableSql = socialMigration.slice(tableStart, next < 0 ? socialMigration.length : next);
      expect(tableSql).toContain("primary key");
    }
    expect(securityMigration).toContain("primary key (follower_id, producer_id)");
    expect(socialMigration).toContain("primary key (blocker_id, blocked_id)");
    expect(socialMigration).toContain("primary key (muter_id, muted_id)");
    expect(community).toContain('upsert({ sender_id: user.id, receiver_id: authorId, status: "pending" }');
  });

  it("persists notifications through server-side social triggers and keeps notification reads user-scoped", () => {
    expect(notificationMigration).toContain("create trigger social_friend_request_notification");
    expect(notificationMigration).toContain("create trigger producer_follow_notification");
    expect(notificationMigration).toContain("create trigger social_post_like_notification");
    expect(securityMigration).toContain('create policy "BeatBox users view own notifications" on public.notifications');
    expect(securityMigration).toContain('create policy "BeatBox users update own notifications" on public.notifications');
  });

  it("keeps producer profiles published-only and excludes original/master paths from catalog loading", () => {
    expect(marketplace).toContain('.from("beats")');
    expect(marketplace).toContain('.eq("status", "published")');
    expect(producer).toContain("loadPublishedBeats");
    expect(producer).not.toContain("original_path");
    expect(producer).not.toContain("master_path");
  });

  it("keeps public Feed rows published-only while retaining typed public content metadata", () => {
    const loadSection = section(community, 'const load = async', 'useEffect(() => { void load');
    expect(loadSection).toContain('from("social_posts")');
    expect(loadSection).toContain('.eq("status", "published")');
    expect(loadSection).toContain('select("id,title,content_type,price,currency,access_mode,description,slug")');
    expect(loadSection).not.toContain("original_path");
    expect(loadSection).not.toContain("master_path");
  });
});
