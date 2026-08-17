import { Bookmark, Loader2, MessageCircle, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { contentReferenceHref } from "@/lib/feed";
import { supabase } from "@/lib/supabase";
import type { SocialPost } from "@/lib/models";

type SavedPost = SocialPost & { saved_at: string | null };

type GateProps = { children: React.ReactNode };

function Gate({ children }: GateProps) {
  const { user, loading } = useSupabaseAuth();
  if (loading) return <section className="status-page"><Loader2 className="spin" /><p>Loading saved items…</p></section>;
  if (!user) return <section className="status-page music-library-gate"><UserRound size={34} /><h1>Sign in to see saved items.</h1><p>Your bookmarks are private to your BeatBox account.</p><Link className="button" href="/auth">Sign in</Link></section>;
  return <>{children}</>;
}

export default function SavedItems() {
  usePageMeta("Saved items", "Your private collection of saved BeatBox community posts and marketplace references.");
  return <Gate><SavedItemsInner /></Gate>;
}

function SavedItemsInner() {
  const { user } = useSupabaseAuth();
  const [items, setItems] = useState<SavedPost[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("social_post_bookmarks")
      .select("post_id,created_at,social_posts!inner(id,author_id,body,content_id,media_path,media_type,link_url,status,like_count,comment_count,share_count,created_at,profiles!social_posts_author_id_fkey(display_name,avatar_url))")
      .eq("user_id", user.id)
      .eq("social_posts.status", "published")
      .order("created_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    const next = (data || []).map((row) => {
      const post = Array.isArray(row.social_posts) ? row.social_posts[0] : row.social_posts;
      return post?.status === "published" ? { ...(post as unknown as SocialPost), saved_at: row.created_at } : null;
    }).filter(Boolean) as SavedPost[];
    setItems(next);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const remove = async (postId: string) => {
    if (!user) return;
    const previous = items;
    setRemoving(postId);
    setItems(current => current.filter(item => item.id !== postId));
    const { error: removeError } = await supabase.from("social_post_bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
    if (removeError) {
      setItems(previous);
      setError(removeError.message);
    }
    setRemoving(null);
  };

  const filtered = items.filter(item => `${item.body || ""} ${item.profiles?.display_name || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="dashboard-page saved-page music-library-page"><div className="container"><div className="dashboard-title"><div><p className="eyebrow"><span /> Private library</p><h1>Saved items</h1><p className="saved-page__lede">Keep community posts and marketplace references close without copying or exposing protected files.</p></div><Link className="button button--small" href="/feed"><MessageCircle size={15} /> Back to Feed</Link></div><div className="library-status"><Bookmark size={17} /><span>{loading ? "Loading your private library" : `${items.length} ${items.length === 1 ? "saved item" : "saved items"}`}</span></div><div className="saved-toolbar"><label htmlFor="saved-search">Filter saved items</label><input id="saved-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your saved posts" /></div>{error && <div className="form-error" role="alert">{error} <button className="text-button" type="button" onClick={() => void load()}>Retry</button></div>}{loading ? <div className="status-inline"><Loader2 className="spin" size={18} /> Loading your saved items…</div> : filtered.length ? <div className="saved-list">{filtered.map(item => <article className="dashboard-panel saved-card" key={item.id}><div className="saved-card__header"><div className="avatar-placeholder">{(item.profiles?.display_name || "B").slice(0, 1).toUpperCase()}</div><div><b>{item.profiles?.display_name || "BeatBox creator"}</b><small>Saved {item.saved_at ? new Date(item.saved_at).toLocaleDateString() : "recently"}</small></div><button className="text-button" type="button" onClick={() => void remove(item.id)} disabled={removing === item.id} aria-label={`Remove ${item.profiles?.display_name || "post"} from saved items`}>{removing === item.id ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} Remove</button></div>{item.body && <p className="saved-card__body">{item.body}</p>}<div className="saved-card__links"><Link className="content-link" href={`/feed?post=${encodeURIComponent(item.id)}`}>Open this post in Feed</Link>{item.content_id && <Link className="content-link" href={contentReferenceHref(item.content_id)}>View attached marketplace content</Link>}</div>{item.media_path && <p className="saved-card__note"><Bookmark size={14} /> Public community media remains available from the Feed.</p>}</article>)}</div> : <div className="empty-featured empty-featured--light"><Bookmark size={34} /><h2>{query ? "No saved items match." : "Nothing saved yet."}</h2><p>{query ? "Try another filter." : "Save a post or marketplace reference from the Feed to build your private library."}</p><Link className="button" href="/feed">Explore the Feed</Link></div>}</div></section>;
}
