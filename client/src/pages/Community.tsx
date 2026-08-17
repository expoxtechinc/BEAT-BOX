import { AudioPreview } from "@/components/AudioPreview";
import { CommentThread } from "@/components/CommentThread";
import { SocialActions } from "@/components/SocialActions";
import { StoryRail } from "@/components/StoryRail";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { contentReferenceHref, FEED_PAGE_SIZE, getFeedRange, normalizeSocialPost, publicPublishedPosts } from "@/lib/feed";
import type { SocialPost } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import "@/styles/community.css";
import {
  Disc3,
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Package,
  Play,
  Search,
  Send,
  Upload,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import React, { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type ContentReference = {
  id: string;
  title: string;
  content_type: string;
  price: number;
  currency: string;
  access_mode: string;
  description: string | null;
  slug: string;
  cover_path: string | null;
};

type DiscoveryCategory = "all" | "creator" | "products" | "music" | "photos" | "videos";

const DISCOVERY_CATEGORIES: Array<{ id: DiscoveryCategory; label: string }> = [
  { id: "all", label: "All categories" },
  { id: "creator", label: "Creator content" },
  { id: "products", label: "Products & services" },
  { id: "music", label: "Music" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
];

function contentTypePresentation(type: string) {
  switch (type) {
    case "movie": return { label: "Movie", mark: "FILM", action: "Watch details", copy: "Published movie release" };
    case "app": return { label: "App", mark: "APP", action: "View app", copy: "Published app release" };
    case "digital_product": return { label: "Digital product", mark: "SHOP", action: "View product", copy: "Published digital product" };
    case "software": return { label: "Software", mark: "CODE", action: "View software", copy: "Published software release" };
    case "plugin": return { label: "Plugin", mark: "PLUGIN", action: "View plugin", copy: "Published creator tool" };
    case "soundboard": return { label: "Soundboard", mark: "BOARD", action: "View soundboard", copy: "Published creator tool" };
    case "soundtrack": return { label: "Soundtrack", mark: "MUSIC", action: "View soundtrack", copy: "Published music release" };
    case "loop": return { label: "Loop", mark: "LOOP", action: "View loop", copy: "Published music release" };
    case "sample_pack": return { label: "Sample pack", mark: "SAMPLES", action: "View samples", copy: "Published music release" };
    case "video": return { label: "Video", mark: "VIDEO", action: "Watch details", copy: "Published video release" };
    default: return { label: "Beat", mark: "BEAT", action: "View beat", copy: "Published beat release" };
  }
}

function formatPostDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function postAttachmentTitle(post: SocialPost, kind: string) {
  const title = post.body?.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 72) : `Community ${kind}`;
}

function discoveryMatches(item: ContentReference, category: DiscoveryCategory) {
  const type = item.content_type;
  if (category === "all" || category === "creator") return true;
  if (category === "products") return ["app", "digital_product", "software", "plugin", "soundboard", "engineering_file"].includes(type);
  if (category === "music") return ["audio", "soundtrack", "loop", "sample_pack"].includes(type);
  if (category === "videos") return ["video", "movie"].includes(type);
  return false;
}

function AudienceBadge({ audience }: { audience: SocialPost["audience"] }) {
  const label = audience === "friends" ? "Friends" : audience === "only_me" ? "Only me" : "Public";
  const Icon = label === "Friends" ? Users : label === "Only me" ? LockKeyhole : Globe2;
  return <span className="community-post__privacy"><Icon size={13} aria-hidden="true" /> {label}</span>;
}

export default function Community() {
  const { user, profile, loading } = useSupabaseAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"public" | "friends" | "only_me">("public");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  const [contentItems, setContentItems] = useState<Record<string, ContentReference>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [feedPage, setFeedPage] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [openAuthorMenu, setOpenAuthorMenu] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string; kind: string; href: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [discoveryItems, setDiscoveryItems] = useState<ContentReference[]>([]);
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory>("all");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const load = useCallback(async (page = 0, append = false) => {
    setLoadingPosts(true);
    setFeedError(null);

    try {
      const [from, to] = getFeedRange(page, FEED_PAGE_SIZE);
      const result = await supabase
        .from("social_posts")
        .select("id,author_id,body,content_id,media_path,media_type,media_gallery,thumbnail_path,link_url,status,audience,like_count,comment_count,share_count,created_at,profiles!social_posts_author_id_fkey(display_name,avatar_url,username,professional_mode)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (result.error) throw result.error;

      const normalized = publicPublishedPosts(
        (result.data || []).map(row => normalizeSocialPost(row as SocialPost & { profiles?: SocialPost["profiles"] | SocialPost["profiles"][] })),
      );

      setPosts(current => append ? [...current, ...normalized] : normalized);
      setHasMore(normalized.length === FEED_PAGE_SIZE);
      setFeedPage(page);

      const publicEntries: Array<[string, string]> = [];
      normalized.forEach(post => {
        const gallery = post.media_gallery?.length
          ? post.media_gallery
          : post.media_path ? [{ path: post.media_path, type: post.media_type || "image" }] : [];

        gallery.forEach((item, index) => {
          const url = supabase.storage.from("social-media").getPublicUrl(item.path).data.publicUrl;
          if (url) publicEntries.push([`${post.id}:${index}`, url]);
        });

        if (post.thumbnail_path) {
          const poster = supabase.storage.from("social-media").getPublicUrl(post.thumbnail_path).data.publicUrl;
          if (poster) publicEntries.push([`${post.id}:poster`, poster]);
        }
      });

      setMediaUrls(current => ({ ...(append ? current : {}), ...Object.fromEntries(publicEntries) }));

      const referencedIds = normalized.map(post => post.content_id).filter((id): id is string => Boolean(id));
      if (referencedIds.length) {
        const referenced = await supabase
          .from("content_items")
          .select("id,title,content_type,price,currency,access_mode,description,slug,cover_path")
          .in("id", referencedIds)
          .eq("status", "published");

        if (referenced.error) throw referenced.error;
        setContentItems(current => ({
          ...(append ? current : {}),
          ...Object.fromEntries((referenced.data || []).map(item => [item.id, item as ContentReference])),
        }));
      } else if (!append) {
        setContentItems({});
      }

      if (user) {
        const [likes, saves, follows] = await Promise.all([
          supabase.from("social_post_likes").select("post_id").eq("user_id", user.id),
          supabase.from("social_post_bookmarks").select("post_id").eq("user_id", user.id),
          supabase.from("producer_follows").select("producer_id").eq("follower_id", user.id),
        ]);

        if (likes.error || saves.error || follows.error) throw likes.error || saves.error || follows.error;
        setLiked(Object.fromEntries((likes.data || []).map(row => [row.post_id, true])));
        setBookmarked(Object.fromEntries((saves.data || []).map(row => [row.post_id, true])));
        setFollowed(Object.fromEntries((follows.data || []).map(row => [row.producer_id, true])));
      }
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Unable to load the public Feed right now.");
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.id]);

  usePullToRefresh(() => load(0, false));

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    void supabase
      .from("content_items")
      .select("id,title,content_type,price,currency,access_mode,description,slug,cover_path")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(result => {
        if (result.error) setDiscoveryError("Discovery is temporarily unavailable.");
        else setDiscoveryItems((result.data || []) as ContentReference[]);
      });
  }, []);

  const requestedPostId = new URLSearchParams(window.location.search).get("post");

  useEffect(() => {
    if (!requestedPostId || !posts.length) return;
    const target = document.getElementById(`feed-post-${requestedPostId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.classList.add("is-deep-linked");
    const timer = window.setTimeout(() => target?.classList.remove("is-deep-linked"), 1800);
    return () => window.clearTimeout(timer);
  }, [posts, requestedPostId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const [items, creators, feedPosts] = await Promise.all([
          supabase.from("content_items").select("id,title,content_type").eq("status", "published").ilike("title", `%${query}%`).order("created_at", { ascending: false }).limit(4),
          supabase.from("profiles").select("id,display_name,username").eq("account_status", "active").or(`display_name.ilike.%${query}%,username.ilike.%${query}%`).limit(3),
          supabase.from("social_posts").select("id,body").eq("status", "published").ilike("body", `%${query}%`).order("created_at", { ascending: false }).limit(3),
        ]);

        const failure = items.error || creators.error || feedPosts.error;
        if (failure) throw failure;

        setSuggestions([
          ...(items.data || []).map(item => ({ id: item.id, title: item.title, kind: item.content_type, href: contentReferenceHref(item.id) })),
          ...(creators.data || []).map(creator => ({ id: creator.id, title: creator.display_name || creator.username || "BeatBox creator", kind: "creator", href: `/creators/${creator.username || creator.id}` })),
          ...(feedPosts.data || []).map(post => ({ id: post.id, title: post.body?.slice(0, 70) || "Community post", kind: "post", href: `/feed?post=${post.id}` })),
        ]);
      } catch (error) {
        setSuggestions([]);
        setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable.");
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const visibleDiscoveryItems = useMemo(
    () => discoveryItems.filter(item => discoveryMatches(item, discoveryCategory)),
    [discoveryCategory, discoveryItems],
  );

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || (!body.trim() && !mediaFiles.length)) return;

    if (mediaFiles.length > 8 || mediaFiles.some(file => file.size > 50 * 1024 * 1024)) {
      setMessage("Choose up to 8 public media files, each 50 MB or smaller.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const gallery = await Promise.all(mediaFiles.map(async file => {
        const type: "image" | "audio" | "video" = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/") ? "video" : "audio";
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const { error: uploadError } = await supabase.storage.from("social-media").upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        return { path, type };
      }));

      const first = gallery[0] || null;
      const { error } = await supabase.from("social_posts").insert({
        author_id: user.id,
        body: body.trim() || null,
        media_path: first?.path || null,
        media_type: first?.type || null,
        media_gallery: gallery,
        audience,
        status: "published",
      });

      if (error) throw error;
      setMessage("Post published to the BeatBox community.");
      setComposerOpen(false);
      setBody("");
      setMediaFiles([]);
      setAudience("public");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish post.");
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async (post: SocialPost) => {
    if (!user) {
      setMessage("Sign in to react to community posts.");
      return;
    }

    const exists = liked[post.id];
    setLiked(current => ({ ...current, [post.id]: !exists }));
    setPosts(current => current.map(item => item.id === post.id ? { ...item, like_count: Math.max(0, item.like_count + (exists ? -1 : 1)) } : item));

    const result = exists
      ? await supabase.from("social_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("social_post_likes").insert({ post_id: post.id, user_id: user.id });

    if (result.error) {
      setLiked(current => ({ ...current, [post.id]: exists }));
      setPosts(current => current.map(item => item.id === post.id ? { ...item, like_count: Math.max(0, item.like_count + (exists ? 1 : -1)) } : item));
      setMessage(result.error.message);
    }
  };

  const toggleBookmark = async (post: SocialPost) => {
    if (!user) {
      setMessage("Sign in to save posts.");
      return;
    }

    const exists = bookmarked[post.id];
    setBookmarked(current => ({ ...current, [post.id]: !exists }));
    const result = exists
      ? await supabase.from("social_post_bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("social_post_bookmarks").insert({ post_id: post.id, user_id: user.id });

    if (result.error) {
      setBookmarked(current => ({ ...current, [post.id]: exists }));
      setMessage(result.error.message);
    }
  };

  const repost = async (post: SocialPost) => {
    if (!user) {
      setMessage("Sign in to repost.");
      return;
    }

    const { error } = await supabase.from("social_reposts").insert({ post_id: post.id, user_id: user.id });
    setMessage(error ? error.message : "Repost saved to your activity.");
  };

  const toggleFollow = async (authorId: string) => {
    if (!user || authorId === user.id) return;
    const exists = followed[authorId];
    const result = exists
      ? await supabase.from("producer_follows").delete().eq("follower_id", user.id).eq("producer_id", authorId)
      : await supabase.from("producer_follows").insert({ follower_id: user.id, producer_id: authorId });

    if (!result.error) {
      setFollowed(current => ({ ...current, [authorId]: !exists }));
      setMessage(exists ? "Unfollowed creator." : "Following creator.");
    } else {
      setMessage(result.error.message);
    }
  };

  const friendAction = async (authorId: string) => {
    if (!user || authorId === user.id) return;

    const [outgoing, incoming] = await Promise.all([
      supabase.from("social_friend_requests").select("requester_id,addressee_id,status").eq("requester_id", user.id).eq("addressee_id", authorId).maybeSingle(),
      supabase.from("social_friend_requests").select("requester_id,addressee_id,status").eq("requester_id", authorId).eq("addressee_id", user.id).maybeSingle(),
    ]);

    if (outgoing.error || incoming.error) {
      setMessage((outgoing.error || incoming.error)?.message || "Unable to check friendship.");
      return;
    }

    if (incoming.data?.status === "pending") {
      const { error } = await supabase.from("social_friend_requests").update({ status: "accepted" }).eq("requester_id", authorId).eq("addressee_id", user.id);
      setMessage(error ? error.message : "Friend request confirmed.");
      return;
    }

    if (outgoing.data?.status === "accepted" || incoming.data?.status === "accepted") {
      const { error } = await supabase.from("social_friend_requests").delete().or(`and(requester_id.eq.${user.id},addressee_id.eq.${authorId}),and(requester_id.eq.${authorId},addressee_id.eq.${user.id})`);
      setMessage(error ? error.message : "Friend removed.");
      return;
    }

    const { error } = await supabase.from("social_friend_requests").upsert(
      { requester_id: user.id, addressee_id: authorId, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
    setMessage(error ? error.message : "Friend request sent.");
  };

  const moderate = async (authorId: string, kind: "block" | "mute") => {
    if (!user || authorId === user.id) return;

    const result = kind === "block"
      ? await supabase.from("social_blocks").upsert({ blocker_id: user.id, blocked_id: authorId })
      : await supabase.from("social_mutes").upsert({ muter_id: user.id, muted_id: authorId });

    setMessage(result.error ? result.error.message : `${kind === "block" ? "Creator blocked" : "Creator muted"}.`);
    if (!result.error && kind === "block") {
      setPosts(current => current.filter(post => post.author_id !== authorId));
    }
  };

  const removePost = async (post: SocialPost) => {
    if (!user || post.author_id !== user.id) return;
    if (!window.confirm("Delete this post permanently?")) return;

    const { error } = await supabase.from("social_posts").delete().eq("id", post.id).eq("author_id", user.id);
    if (error) setMessage(error.message);
    else {
      setPosts(current => current.filter(item => item.id !== post.id));
      setMessage("Post deleted.");
    }
  };

  const report = async (post: SocialPost) => {
    if (!user) {
      setMessage("Sign in to report content.");
      return;
    }

    const reason = window.prompt("Why are you reporting this post?");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reason: reason.trim(),
      reported_post_id: post.id,
      description: "Community post report",
    });
    setMessage(error ? error.message : "Report submitted for moderation.");
  };

  if (loading) {
    return <section className="status-page"><Loader2 className="spin" /><p>Loading community…</p></section>;
  }

  const lightbox = lightboxUrl ? (
    <div className="feed-lightbox" role="dialog" aria-modal="true" aria-label="Community image viewer" onClick={() => setLightboxUrl(null)}>
      <button type="button" className="feed-lightbox__close" onClick={() => setLightboxUrl(null)}>Close</button>
      <img src={lightboxUrl} alt="Expanded community attachment" onClick={event => event.stopPropagation()} />
    </div>
  ) : null;

  return (
    <section className="dashboard-page community-page">
      <div className="container">
        <StoryRail />

        <div className="dashboard-title">
          <div>
            <p className="eyebrow"><span /> BeatBox community</p>
            <h1>Build in public. Move together.</h1>
          </div>
          {user ? (
            <Link className="button button--small" href="/studio"><UserPlus size={15} /> Open studio</Link>
          ) : (
            <Link className="button button--small" href="/auth">Join the community</Link>
          )}
        </div>

        <div className="feed-search" role="search">
          <label htmlFor="feed-marketplace-search"><Search size={16} /> Search marketplace beats</label>
          <input
            id="feed-marketplace-search"
            className="input"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search published beats and creator content"
            autoComplete="off"
            aria-expanded={suggestions.length > 0}
          />
          {(searching || suggestions.length > 0 || searchError || (searchQuery.trim().length >= 2 && !searching)) && (
            <div className="feed-search__suggestions" role="listbox">
              {searching ? <span className="feed-search__status">Searching…</span>
                : searchError ? <span className="feed-search__status form-error">{searchError}</span>
                  : suggestions.length ? suggestions.map(item => (
                    <Link key={`${item.kind}-${item.id}`} href={item.href} role="option" onClick={() => { setSearchQuery(""); setSuggestions([]); }}>
                      <b>{item.title}</b><small>{item.kind}</small>
                    </Link>
                  ))
                    : <span className="feed-search__status">No matching creators, posts, or published marketplace items.</span>}
            </div>
          )}
        </div>

        <section className="dashboard-panel feed-discovery" aria-labelledby="feed-discovery-title">
          <div className="dashboard-title">
            <div>
              <p className="eyebrow"><span /> Discover</p>
              <h2 id="feed-discovery-title">Fresh from BeatBox creators</h2>
            </div>
            <Link className="text-button" href="/catalog">Browse all</Link>
          </div>
          <div className="feed-discovery__chips" role="tablist" aria-label="Filter creator discovery">
            {DISCOVERY_CATEGORIES.map(category => (
              <button
                type="button"
                role="tab"
                aria-selected={discoveryCategory === category.id}
                className={discoveryCategory === category.id ? "is-active" : ""}
                key={category.id}
                onClick={() => setDiscoveryCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
          {discoveryError ? <p className="feed-search__status form-error" role="alert">{discoveryError}</p>
            : visibleDiscoveryItems.length ? (
              <div className="feed-discovery__grid">
                {visibleDiscoveryItems.map(item => {
                  const presentation = contentTypePresentation(item.content_type);
                  return (
                    <Link key={item.id} className={`feed-content-card feed-content-card--${item.content_type}`} data-content-type={item.content_type} href={contentReferenceHref(item.id)}>
                      <div className="feed-content-card__copy">
                        <span className="feed-content-card__type-mark" aria-hidden="true">{presentation.mark}</span>
                        <span className="eyebrow"><Package size={13} /> {presentation.label}</span>
                        <h3>{item.title}</h3>
                        <small>{presentation.copy}</small>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <span className="content-link">{presentation.action} <ExternalLink size={15} /></span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="feed-search__status">{discoveryCategory === "all" ? "Published creator drops will appear here." : `No recent ${DISCOVERY_CATEGORIES.find(category => category.id === discoveryCategory)?.label.toLowerCase()} are available in the creator catalog yet.`}</p>
            )}
        </section>

        <button type="button" className="button button--small composer-sheet-trigger" onClick={() => setComposerOpen(true)}>
          <Send size={15} /> Create post
        </button>

        <form className={`dashboard-panel community-composer ${composerOpen ? "is-open" : ""}`} onSubmit={publish}>
          <div className="community-composer__heading">
            <h2>Share an update</h2>
            <button type="button" className="text-button community-composer__close" onClick={() => setComposerOpen(false)}>Close</button>
          </div>
          <textarea
            rows={3}
            maxLength={3000}
            placeholder={user ? `What are you creating, ${profile?.display_name || "creator"}?` : "Sign in to share with the community."}
            value={body}
            onChange={event => setBody(event.target.value)}
            disabled={!user}
          />
          <label className="feed-composer__privacy" htmlFor="post-audience">
            <span>Who can see this?</span>
            <select id="post-audience" value={audience} onChange={event => setAudience(event.target.value as "public" | "friends" | "only_me")} disabled={!user}>
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>
          <label className="file-input file-input--compact">
            <Upload size={16} />
            <b>{mediaFiles.length ? `${mediaFiles.length} public attachment${mediaFiles.length === 1 ? "" : "s"} selected` : "Attach images, audio, or video"}</b>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,audio/*,video/mp4,video/webm" onChange={event => setMediaFiles(Array.from(event.target.files || []).slice(0, 8))} disabled={!user} />
          </label>
          <div>
            <small>{body.length}/3000 · {audience === "public" ? "Public post · Anyone can see this" : audience === "friends" ? "Friends only · mutual accepted friends can see this" : "Only you can see this"}</small>
            <button className="button button--small" disabled={!user || busy || (!body.trim() && !mediaFiles.length)}>
              {busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />} Publish
            </button>
          </div>
          {message && <p className={message.includes("error") || message.includes("Sign in") ? "form-error" : "form-success"}>{message}</p>}
        </form>

        {feedError && <div className="form-error feed-error" role="alert">{feedError} <button className="text-button" type="button" onClick={() => void load(0, false)}>Retry</button></div>}

        {loadingPosts && !posts.length ? (
          <div className="empty-featured empty-featured--light"><Loader2 className="spin" size={34} /><h2>Loading the BeatBox Feed…</h2><p>Checking published updates and secure media links.</p></div>
        ) : (
          <>
            <div className="community-feed">
              {posts.length ? posts.map(post => {
                const gallery = post.media_gallery?.length
                  ? post.media_gallery
                  : post.media_path ? [{ path: post.media_path, type: post.media_type || "image" }] : [];
                const attachedContent = post.content_id ? contentItems[post.content_id] : undefined;
                const attachmentArtwork = attachedContent?.cover_path
                  ? supabase.storage.from("content-covers").getPublicUrl(attachedContent.cover_path).data.publicUrl
                  : post.profiles?.avatar_url || null;
                const isOtherCreator = Boolean(user && user.id !== post.author_id);

                return (
                  <article id={`feed-post-${post.id}`} className="dashboard-panel community-post" key={post.id}>
                    <header className="community-post__header">
                      <Link className="community-post__identity" href={`/producers/${post.author_id}`}>
                        <span className="community-post__avatar">
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" /> : (post.profiles?.display_name || "B").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="community-post__identity-copy">
                          <b>{post.profiles?.display_name || "BeatBox creator"}{post.profiles?.professional_mode && <em>Professional</em>}</b>
                          <small>{formatPostDate(post.created_at)}</small>
                        </span>
                      </Link>
                      <div className="community-post__header-actions">
                        <AudienceBadge audience={post.audience} />
                        {isOtherCreator && (
                          <div className="community-post__author-controls">
                            <button
                              type="button"
                              className="community-post__more-button"
                              aria-label="Creator options"
                              aria-expanded={openAuthorMenu === post.id}
                              onClick={() => setOpenAuthorMenu(current => current === post.id ? null : post.id)}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                            {openAuthorMenu === post.id && (
                              <div className="community-post__author-menu" role="menu">
                                <button type="button" onClick={() => { void toggleFollow(post.author_id); setOpenAuthorMenu(null); }} role="menuitem">{followed[post.author_id] ? "Unfollow creator" : "Follow creator"}</button>
                                <button type="button" onClick={() => { void friendAction(post.author_id); setOpenAuthorMenu(null); }} role="menuitem">Add or confirm friend</button>
                                <button type="button" onClick={() => { void moderate(post.author_id, "mute"); setOpenAuthorMenu(null); }} role="menuitem">Mute creator</button>
                                <button type="button" className="is-danger" onClick={() => { void moderate(post.author_id, "block"); setOpenAuthorMenu(null); }} role="menuitem">Block creator</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </header>

                    {post.body && <p className="community-post__body">{post.body}</p>}

                    {post.link_url && (
                      <a className="content-link community-post__link" href={post.link_url} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} /> Open shared link
                      </a>
                    )}

                    {gallery.length > 0 && (
                      <div className={`community-post__media community-post__media--gallery community-post__media--${gallery.length === 1 ? "single" : "multiple"}`}>
                        {gallery.slice(0, 4).map((item, index) => {
                          const key = `${post.id}:${index}`;
                          const url = mediaUrls[key];
                          if (!url) return null;

                          if (item.type === "image") {
                            return (
                              <figure className="community-post__media-item community-post__media-item--image" key={key}>
                                <button type="button" className="community-post__image-button" onClick={() => setLightboxUrl(url)} aria-label="Open community image">
                                  <img loading="lazy" src={url} alt={`Photo shared by ${post.profiles?.display_name || "a BeatBox creator"}`} onError={() => setMediaErrors(current => ({ ...current, [key]: true }))} />
                                  <span><Maximize2 size={15} /> View photo</span>
                                </button>
                                <figcaption><ImageIcon size={14} /> Photo · Tap to expand</figcaption>
                              </figure>
                            );
                          }

                          if (item.type === "video") {
                            return (
                              <figure className="community-post__media-item community-post__media-item--video" key={key}>
                                <div className="community-video-card">
                                  <video controls playsInline preload="metadata" poster={mediaUrls[`${post.id}:poster`]} src={url} onError={() => setMediaErrors(current => ({ ...current, [key]: true }))} />
                                  <span className="community-video-card__badge"><Play size={14} fill="currentColor" /> Video</span>
                                </div>
                                <figcaption><Video size={14} /> Play public video</figcaption>
                              </figure>
                            );
                          }

                          return (
                            <article className="community-post__media-item community-post__media-item--audio" key={key}>
                              <div className="community-audio-card">
                                <span className="community-audio-card__art" aria-hidden="true">
                                  {attachmentArtwork ? <img src={attachmentArtwork} alt="" /> : <Disc3 size={28} />}
                                </span>
                                <div className="community-audio-card__details">
                                  <span>Audio update</span>
                                  <b>{attachedContent?.title || postAttachmentTitle(post, "audio")}</b>
                                  <small>Public audio · Tap play to listen</small>
                                  <AudioPreview src={url} title={attachedContent?.title || postAttachmentTitle(post, "audio")} compact publicPreview />
                                </div>
                              </div>
                            </article>
                          );
                        })}
                        {gallery.length > 4 && <span className="community-post__media-more">+{gallery.length - 4} more attachments</span>}
                        {gallery.some((_, index) => mediaErrors[`${post.id}:${index}`]) && <small className="form-error community-post__media-error">One or more public attachments could not be loaded.</small>}
                      </div>
                    )}

                    {attachedContent && (
                      <div className={`feed-content-card feed-content-card--${attachedContent.content_type}`} data-content-type={attachedContent.content_type}>
                        <div className="feed-content-card__copy">
                          <span className="feed-content-card__type-mark" aria-hidden="true">{contentTypePresentation(attachedContent.content_type).mark}</span>
                          <span className="eyebrow"><Package size={13} /> {contentTypePresentation(attachedContent.content_type).label}</span>
                          <h3>{attachedContent.title}</h3>
                          <small>{contentTypePresentation(attachedContent.content_type).copy} · {attachedContent.access_mode === "paid_download" ? `${attachedContent.currency} ${attachedContent.price}` : "Free or stream access"}</small>
                          {attachedContent.description && <p>{attachedContent.description}</p>}
                        </div>
                        <Link href={contentReferenceHref(post.content_id!)} className="content-link"><ExternalLink size={15} /> {contentTypePresentation(attachedContent.content_type).action}</Link>
                      </div>
                    )}

                    {post.content_id && !attachedContent && (
                      <Link href={contentReferenceHref(post.content_id)} className="content-link"><ExternalLink size={15} /> View attached creator content</Link>
                    )}

                    <SocialActions
                      postId={post.id}
                      userId={user?.id}
                      liked={Boolean(liked[post.id])}
                      bookmarked={Boolean(bookmarked[post.id])}
                      likeCount={post.like_count}
                      commentCount={post.comment_count}
                      shareCount={post.share_count}
                      onLike={() => void toggleLike(post)}
                      onSave={() => void toggleBookmark(post)}
                      onComment={() => setOpenComments(current => ({ ...current, [post.id]: !current[post.id] }))}
                      onRepost={() => void repost(post)}
                      onReport={() => void report(post)}
                      onDelete={user?.id === post.author_id ? () => void removePost(post) : undefined}
                      onShared={() => setPosts(current => current.map(item => item.id === post.id ? { ...item, share_count: item.share_count + 1 } : item))}
                    />

                    {openComments[post.id] && (
                      <CommentThread
                        postId={post.id}
                        userId={user?.id}
                        onCountChange={delta => setPosts(current => current.map(item => item.id === post.id ? { ...item, comment_count: Math.max(0, item.comment_count + delta) } : item))}
                      />
                    )}
                  </article>
                );
              }) : (
                <div className="empty-featured empty-featured--light"><MessageCircle size={34} /><h2>The feed is ready for its first update.</h2><p>Share a launch, a new beat, a product, or a collaboration request.</p></div>
              )}
            </div>

            {hasMore && (
              <div className="feed-pagination">
                <button className="button button--ghost" type="button" onClick={() => void load(feedPage + 1, true)} disabled={loadingPosts}>
                  {loadingPosts ? <Loader2 className="spin" size={15} /> : null}
                  {loadingPosts ? "Loading more…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {lightbox}
    </section>
  );
}
