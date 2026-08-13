import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Loader2, Play, Upload, UserRoundX, Volume2, VolumeX } from "lucide-react";
import { SocialActions } from "@/components/SocialActions";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/lib/supabase";
import { formatUploadSize, uploadResumable } from "@/lib/resumableUpload";
import { prepareReelMedia, type ReelMediaProgress } from "@/lib/reelMedia";
import type { SocialPost } from "@/lib/models";
import { toast } from "sonner";

type ReelPost = SocialPost & { reel_id?: string; caption?: string | null; creator_id?: string; thumbnail_path?: string | null };

function ReelUpload({ onPublished }: { onPublished: () => void }) {
  const { user } = useSupabaseAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadController, setUploadController] = useState<AbortController | null>(null);
  if (!user) return <div className="reels-upload-note"><Link href="/auth">Sign in</Link> to publish a Reel.</div>;
  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setMessage("Choose a video first."); return; }
    if (!file.type.startsWith("video/")) { setMessage("Reels must be video files."); return; }
    if (file.size > 250 * 1024 * 1024) { setMessage("Reels must be 250 MB or smaller before browser compression."); return; }
    setBusy(true); setUploadProgress(0); setMessage("Preparing your Reel in this browser…");
    const controller = new AbortController();
    setUploadController(controller);
    try {
      const prepared = await prepareReelMedia(file, (progress: ReelMediaProgress) => {
        const prefix = progress.stage === "thumbnail" ? "Generating thumbnail" : "Compressing video";
        setMessage(`${prefix} · ${progress.percent}%`);
      });
      if (controller.signal.aborted) throw new DOMException("Upload paused", "AbortError");
      const id = crypto.randomUUID();
      const safeName = prepared.video.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${id}-${safeName}`;
      const thumbnailPath = `${user.id}/${id}-thumbnail.jpg`;
      await uploadResumable({ bucket: "social-media", objectPath: path, file: prepared.video, signal: controller.signal, onProgress: (percent, uploaded, total) => { setUploadProgress(percent); setMessage(`Uploading ${percent}% · ${formatUploadSize(uploaded)} of ${formatUploadSize(total)} — safe to retry if interrupted.`); } });
      await uploadResumable({ bucket: "social-media", objectPath: thumbnailPath, file: prepared.thumbnail, signal: controller.signal, onProgress: (percent) => { setUploadProgress(Math.round(85 + percent * 0.15)); setMessage(`Uploading thumbnail ${percent}%…`); } });
      const post = await supabase.from("social_posts").insert({ author_id: user.id, body: caption.trim() || null, media_path: path, thumbnail_path: thumbnailPath, media_type: "video", status: "published" }).select("id").single();
      if (post.error || !post.data) throw post.error || new Error("Unable to create the Reel post.");
      const reel = await supabase.from("social_reels").insert({ post_id: post.data.id, creator_id: user.id, caption: caption.trim() || null, status: "published" });
      if (reel.error) throw reel.error;
      setFile(null); setCaption(""); setUploadProgress(100); const successMessage = prepared.compressed ? "Your compressed Reel and thumbnail are live in the vertical viewer." : "Your Reel and thumbnail are live in the vertical viewer."; setMessage(successMessage); toast.success("Reel published", { description: "Your Reel is now available in the vertical viewer." }); onPublished();
    } catch (error) { setMessage(error instanceof DOMException && error.name === "AbortError" ? "Upload paused. Choose the file again to retry." : error instanceof Error ? error.message : "Unable to publish Reel. You can retry to resume the upload."); } finally { setBusy(false); setUploadController(null); }
  };
  return <form id="reel-upload" className="dashboard-panel reels-upload" onSubmit={publish}><div><p className="eyebrow"><span /> Creator upload</p><h2>Publish a Reel</h2><p className="muted-copy">Your browser creates a lightweight video and first-frame thumbnail before resumable upload. Never upload paid masters or private payment files here.</p></div><label className="file-drop"><Upload size={20} /><span>{file ? file.name : "Choose a video"}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setFile(event.target.files?.[0] || null)} /></label>{file && <p className="upload-meta">{file.name} · {formatUploadSize(file.size)} · Browser preparation and resumable upload are enabled.</p>}<textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={500} placeholder="Add a caption" rows={2} />{busy && <div className="upload-progress" aria-live="polite"><div className="upload-progress__label"><span>Preparing or uploading Reel</span><b>{uploadProgress}%</b></div><progress max="100" value={uploadProgress}>{uploadProgress}%</progress><button className="button button--small" type="button" onClick={() => uploadController?.abort()}>Pause upload</button></div>}<button className="button" disabled={busy || !file} type="submit">{busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />} {busy ? `Working ${uploadProgress}%` : "Publish Reel"}</button>{message && <p className={message.includes("live") ? "form-success" : "form-error"} role="status">{message}</p>}</form>;
}

export default function Reels() {
  usePageMeta("Reels", "Watch and publish short-form BeatBox creator videos.");
  const { user } = useSupabaseAuth();
  const [posts, setPosts] = useState<ReelPost[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const [notInterested, setNotInterested] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    const [result, preferences] = await Promise.all([supabase.from("social_reels").select("id,post_id,caption,creator_id,social_posts!inner(id,author_id,body,media_path,thumbnail_path,media_type,audience,like_count,comment_count,share_count,created_at,status,profiles(display_name,avatar_url,username,professional_mode))").eq("status", "published").eq("social_posts.status", "published").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50), user ? supabase.from("social_post_not_interested").select("post_id").eq("user_id", user.id) : Promise.resolve({ data: [], error: null } as { data: Array<{ post_id: string }>; error: null })]);
    const hidden = new Set((preferences.data || []).map(row => row.post_id)); setNotInterested(Object.fromEntries(Array.from(hidden).map(id => [id, true]))); const next = (result.data || []).map(row => { const post = Array.isArray(row.social_posts) ? row.social_posts[0] : row.social_posts; if (!post) return null; return { ...(post as unknown as ReelPost), reel_id: row.id, caption: row.caption, creator_id: row.creator_id }; }).filter(post => Boolean(post) && !hidden.has((post as ReelPost).id)) as ReelPost[];
    setPosts(next);
    const nextUrls: Record<string, string> = {};
    const nextThumbnailUrls: Record<string, string> = {};
    next.forEach(post => {
      if (post.media_path) nextUrls[post.id] = supabase.storage.from("social-media").getPublicUrl(post.media_path).data.publicUrl;
      if (post.thumbnail_path) nextThumbnailUrls[post.id] = supabase.storage.from("social-media").getPublicUrl(post.thumbnail_path).data.publicUrl;
    });
    setUrls(nextUrls); setThumbnailUrls(nextThumbnailUrls); setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);
  const hideReel = async (post: ReelPost) => { if (!user) { setNotice("Sign in to tune your Reel feed."); return; } const { error } = await supabase.from("social_post_not_interested").upsert({ user_id: user.id, post_id: post.id }); if (error) { setNotice(error.message); return; } setNotInterested(current => ({ ...current, [post.id]: true })); setPosts(current => current.filter(item => item.id !== post.id)); setActive(0); setNotice("Thanks. We’ll show fewer Reels like this."); toast.success("Feed updated", { description: "This Reel has been removed from your view." }); };
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { const index = Number((entry.target as HTMLElement).dataset.index); if (!Number.isNaN(index)) setActive(index); } }), { threshold: 0.7 });
    document.querySelectorAll<HTMLElement>(".reel-card").forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [posts.length]);
  const move = (delta: number) => { const target = Math.max(0, Math.min(posts.length - 1, active + delta)); document.querySelector<HTMLElement>(`.reel-card[data-index="${target}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return <section className="reels-page"><div className="container"><div className="dashboard-title"><div><p className="eyebrow"><span /> BeatBox Reels</p><h1>Scroll the sound forward.</h1><p className="muted-copy">Swipe or scroll vertically through public creator videos, just like a short-form video feed. Paid marketplace masters remain protected and never appear in public Reels.</p></div><Link className="button button--small" href="/feed">Back to Feed</Link></div><ReelUpload onPublished={() => void load()} />{loading ? <div className="status-page"><Loader2 className="spin" /><p>Loading Reels…</p></div> : posts.length ? <div className="reels-viewer"><div className="reels-scroller">{posts.map((post, index) => <article className="reel-card" data-index={index} key={post.id}>{urls[post.id] ? <video className="reel-card__video" controls playsInline muted={muted} autoPlay={index === active} loop preload="metadata" poster={thumbnailUrls[post.id]} src={urls[post.id]} aria-label={`Reel by ${post.profiles?.display_name || "BeatBox creator"}`} /> : <div className="reel-card__empty"><Play size={28} /><span>Public video unavailable</span></div>}<div className="reel-card__overlay"><div className="reel-card__creator"><div className="reel-card__creator-line"><b>{post.profiles?.display_name || "BeatBox creator"}</b>{post.profiles?.professional_mode ? <span className="verified-badge">Professional</span> : null}<small>{post.audience === "friends" ? "Friends" : post.audience === "only_me" ? "Only me" : "Public"}</small></div><p>{post.caption || post.body || "New BeatBox Reel"}</p></div><button className="reel-control" type="button" onClick={() => setMuted(current => !current)} aria-label={muted ? "Unmute Reel" : "Mute Reel"}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div><SocialActions postId={post.id} userId={user?.id} liked={false} bookmarked={false} likeCount={post.like_count} commentCount={post.comment_count} shareCount={post.share_count} onLike={() => undefined} onSave={() => undefined} onComment={() => undefined} onRepost={() => undefined} onReport={() => undefined} onNotInterested={() => void hideReel(post)} audienceLabel={post.audience === "friends" ? "Friends" : post.audience === "only_me" ? "Only me" : "Public"} /></article>)}</div><div className="reels-nav" aria-label="Reel navigation"><button className="reel-control" type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous Reel"><ChevronUp /></button><span>{active + 1} / {posts.length}</span><button className="reel-control" type="button" onClick={() => move(1)} disabled={active === posts.length - 1} aria-label="Next Reel"><ChevronDown /></button></div>{notice && <p className="reels-notice" role="status">{notice}</p>}</div> : <div className="empty-featured empty-featured--light"><Play size={34} /><h2>No public Reels yet.</h2><p>Publish the first short creator video above.</p></div>}</div></section>;
}
