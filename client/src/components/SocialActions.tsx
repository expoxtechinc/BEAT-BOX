import { Bookmark, Copy, Facebook, Heart, MessageCircle, Repeat2, Send, Share2, ShieldAlert, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  postId: string;
  userId?: string;
  liked: boolean;
  bookmarked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
  onRepost: () => void;
  onReport: () => void;
  onShared?: () => void;
};

export function SocialActions({ postId, userId, liked, bookmarked, likeCount, commentCount, shareCount, onLike, onSave, onComment, onRepost, onReport, onShared }: Props) {
  const [open, setOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/feed?post=${postId}`;
  const chooseReaction = async (nextReaction: string) => {
    if (!userId) { setMessage("Sign in to react to posts."); return; }
    const { error } = await supabase.from("social_post_reactions").upsert({ post_id: postId, user_id: userId, reaction: nextReaction }, { onConflict: "post_id,user_id" });
    if (error) setMessage(error.message); else { setReaction(nextReaction); setReactionOpen(false); }
  };
  const share = async (target: "copy" | "whatsapp" | "facebook" | "x" | "telegram") => {
    if (!userId) { setMessage("Sign in to share posts."); return; }
    try {
      if (target === "copy") await navigator.clipboard.writeText(url);
      else if (target === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
      else if (target === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
      else if (target === "x") window.open(`https://x.com/intent/post?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
      else window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
      const result = await supabase.from("social_post_shares").insert({ post_id: postId, user_id: userId, channel: target });
      if (result.error) throw result.error;
      onShared?.();
      setMessage(target === "copy" ? "Post link copied." : "Share opened.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to share this post."); }
  };
  return <div className="community-post__action-wrap"><div className="community-post__actions" aria-label="Post actions">
    <button type="button" onClick={onLike} className={liked ? "is-active" : ""} aria-label={liked ? "Unlike post" : "Like post"}><Heart size={16} /> {likeCount}</button><button type="button" onClick={() => setReactionOpen(value => !value)} aria-expanded={reactionOpen} aria-haspopup="menu" className={reaction ? "is-active" : ""}><Sparkles size={16} /> {reaction ? reaction : "React"}</button>
    <button type="button" onClick={onComment} aria-label="Open comments"><MessageCircle size={16} /> {commentCount}</button>
    <button type="button" onClick={onRepost} aria-label="Repost"><Repeat2 size={16} /> Repost</button>
    <button type="button" onClick={onSave} className={bookmarked ? "is-active" : ""} aria-label={bookmarked ? "Remove saved post" : "Save post"}><Bookmark size={16} /> {bookmarked ? "Saved" : "Save"}</button>
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu"><Share2 size={16} /> {shareCount ? shareCount : "Share"}</button>
    <button type="button" className="text-button" onClick={onReport} aria-label="Report post"><ShieldAlert size={15} /></button>
  </div>{reactionOpen && <div className="share-menu reaction-menu" role="menu" aria-label="Choose reaction">{[["like","Like"],["love","Love"],["haha","Haha"],["wow","Wow"],["sad","Sad"],["angry","Angry"]].map(([value, label]) => <button key={value} type="button" onClick={() => void chooseReaction(value)} role="menuitem">{label}</button>)}</div>}{open && <div className="share-menu" role="menu"><button type="button" onClick={() => void share("copy")} role="menuitem"><Copy size={14} /> Copy link</button>{typeof navigator !== "undefined" && "share" in navigator && <button type="button" onClick={async () => { try { await navigator.share({ title: "BeatBox post", url }); setMessage("Share sheet opened."); } catch { /* cancelled */ } }} role="menuitem"><Send size={14} /> Device share</button>}<button type="button" onClick={() => void share("whatsapp")} role="menuitem"><Send size={14} /> WhatsApp</button><button type="button" onClick={() => void share("facebook")} role="menuitem"><Facebook size={14} /> Facebook</button><button type="button" onClick={() => void share("x")} role="menuitem"><Share2 size={14} /> X</button><button type="button" onClick={() => void share("telegram")} role="menuitem"><Send size={14} /> Telegram</button></div>}{message && <small className="form-success" role="status">{message}</small>}</div>;
}
