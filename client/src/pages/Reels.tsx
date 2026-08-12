import { Loader2, Play, UserPlus, Volume2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import type { SocialPost } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { SocialActions } from "@/components/SocialActions";
import { CommentThread } from "@/components/CommentThread";

export default function Reels() {
  const { user } = useSupabaseAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const reels = await supabase.from("social_reels").select("post_id,caption,creator_id,social_posts(id,author_id,body,media_path,media_type,like_count,comment_count,share_count,created_at,profiles(display_name,avatar_url))").eq("status", "published").order("created_at", { ascending: false }).limit(30);
      if (!active) return;
      const next = (reels.data || []).map(row => {
        const post = Array.isArray(row.social_posts) ? row.social_posts[0] : row.social_posts;
        const source = post as (SocialPost & { profiles?: SocialPost["profiles"] | SocialPost["profiles"][] }) | null;
        return source ? { ...source, content_id: source.content_id || null, link_url: source.link_url || null, status: source.status || "published", profiles: Array.isArray(source.profiles) ? source.profiles[0] || null : source.profiles || null } : null;
      }).filter(Boolean) as SocialPost[];
      setPosts(next);
      const nextUrls: Record<string, string> = {};
      next.forEach(post => { if (post.media_path) nextUrls[post.id] = supabase.storage.from("social-media").getPublicUrl(post.media_path).data.publicUrl; });
      setUrls(nextUrls);
      if (user && next.length) {
        const [likes, saves, follows] = await Promise.all([
          supabase.from("social_post_likes").select("post_id").eq("user_id", user.id).in("post_id", next.map(post => post.id)),
          supabase.from("social_post_bookmarks").select("post_id").eq("user_id", user.id).in("post_id", next.map(post => post.id)),
          supabase.from("producer_follows").select("producer_id").eq("follower_id", user.id).in("producer_id", next.map(post => post.author_id)),
        ]);
        setLiked(Object.fromEntries((likes.data || []).map(row => [row.post_id, true])));
        setBookmarked(Object.fromEntries((saves.data || []).map(row => [row.post_id, true])));
        setFollowed(Object.fromEntries((follows.data || []).map(row => [row.producer_id, true])));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const toggleLike = async (post: SocialPost) => {
    if (!user) { setMessage("Sign in to react to Reels."); return; }
    const exists = Boolean(liked[post.id]);
    setLiked(current => ({ ...current, [post.id]: !exists }));
    setPosts(current => current.map(item => item.id === post.id ? { ...item, like_count: Math.max(0, item.like_count + (exists ? -1 : 1)) } : item));
    const result = exists ? await supabase.from("social_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id) : await supabase.from("social_post_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setLiked(current => ({ ...current, [post.id]: exists })); setMessage(result.error.message); }
  };

  const toggleBookmark = async (post: SocialPost) => {
    if (!user) { setMessage("Sign in to save Reels."); return; }
    const exists = Boolean(bookmarked[post.id]);
    setBookmarked(current => ({ ...current, [post.id]: !exists }));
    const result = exists ? await supabase.from("social_post_bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id) : await supabase.from("social_post_bookmarks").insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setBookmarked(current => ({ ...current, [post.id]: exists })); setMessage(result.error.message); }
  };

  const followCreator = async (authorId: string) => {
    if (!user) { setMessage("Sign in to follow creators."); return; }
    if (authorId === user.id) return;
    const exists = Boolean(followed[authorId]);
    const result = exists ? await supabase.from("producer_follows").delete().eq("follower_id", user.id).eq("producer_id", authorId) : await supabase.from("producer_follows").insert({ follower_id: user.id, producer_id: authorId });
    if (result.error) setMessage(result.error.message); else { setFollowed(current => ({ ...current, [authorId]: !exists })); setMessage(exists ? "Creator unfollowed." : "Creator followed."); }
  };

  const repost = async (post: SocialPost) => {
    if (!user) { setMessage("Sign in to repost."); return; }
    const { error } = await supabase.from("social_reposts").insert({ post_id: post.id, user_id: user.id });
    setMessage(error ? error.message : "Repost saved to your activity.");
  };

  const report = async (post: SocialPost) => {
    if (!user) { setMessage("Sign in to report content."); return; }
    const reason = window.prompt("Why are you reporting this Reel?");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, reason: reason.trim(), reported_post_id: post.id, description: "Reel report" });
    setMessage(error ? error.message : "Report submitted for moderation.");
  };

  return <section className="reels-page"><div className="container"><div className="dashboard-title"><div><p className="eyebrow"><span /> BeatBox Reels</p><h1>Short drops from Liberia’s creators.</h1><p className="muted-copy">Public short videos only. Paid marketplace masters remain protected behind their verified access workflows.</p></div><Link className="button button--small" href="/feed">Back to Feed</Link></div>{message && <div className="notice-banner" role="status">{message}</div>}{loading ? <div className="status-page"><Loader2 className="spin" /><p>Loading Reels…</p></div> : posts.length ? <div className="reels-scroller">{posts.map(post => <article className="reel-card" key={post.id}>{urls[post.id] ? <video className="reel-card__video" controls autoPlay muted loop playsInline preload="metadata" src={urls[post.id]} aria-label={`Reel by ${post.profiles?.display_name || "BeatBox creator"}`} /> : <div className="reel-card__empty"><Play size={28} /><span>Public video unavailable</span></div>}<div className="reel-card__overlay"><div><b>{post.profiles?.display_name || "BeatBox creator"}</b><p>{post.body || "New BeatBox Reel"}</p>{user && user.id !== post.author_id && <button type="button" className="text-button" onClick={() => void followCreator(post.author_id)}><UserPlus size={14} /> {followed[post.author_id] ? "Following" : "Follow creator"}</button>}</div><Volume2 size={18} aria-hidden="true" /></div><SocialActions postId={post.id} userId={user?.id} liked={Boolean(liked[post.id])} bookmarked={Boolean(bookmarked[post.id])} likeCount={post.like_count} commentCount={post.comment_count} shareCount={post.share_count} onLike={() => void toggleLike(post)} onSave={() => void toggleBookmark(post)} onComment={() => setCommentsOpen(current => ({ ...current, [post.id]: !current[post.id] }))} onRepost={() => void repost(post)} onReport={() => void report(post)} onShared={() => setMessage("Share recorded.")} />{commentsOpen[post.id] && <CommentThread postId={post.id} userId={user?.id} onCountChange={delta => setPosts(current => current.map(item => item.id === post.id ? { ...item, comment_count: Math.max(0, item.comment_count + delta) } : item))} />}</article>)}</div> : <div className="empty-featured empty-featured--light"><Play size={34} /><h2>No public Reels yet.</h2><p>Short creator videos will appear here when published.</p></div>}</div></section>;
}
