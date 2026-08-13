import { ImagePlus, Loader2, Plus, Volume2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { uploadResumable } from "@/lib/resumableUpload";
import { supabase } from "@/lib/supabase";
import { StoryViewer, type StoryItem } from "@/components/StoryViewer";

type ProfileRow = { display_name?: string | null; username?: string | null; avatar_url?: string | null };
type StoryRow = {
  id: string; author_id: string; status_text?: string | null; media_path?: string | null; media_type?: "image" | "video" | "audio" | null;
  audience: "public" | "friends" | "only_me"; created_at: string; expires_at: string; profiles?: ProfileRow | ProfileRow[] | null;
};

const MAX_STORY_BYTES = 50 * 1024 * 1024;
const getProfile = (profile?: ProfileRow | ProfileRow[] | null) => Array.isArray(profile) ? profile[0] : profile;
const mediaTypeFor = (file: File): "image" | "video" | "audio" | null => file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : null;

export function StoryRail() {
  const { user, profile } = useSupabaseAuth();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false); const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [statusText, setStatusText] = useState(""); const [audience, setAudience] = useState<StoryRow["audience"]>("public"); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [uploadProgress, setUploadProgress] = useState(0);

  const loadStories = async () => {
    const { data, error } = await supabase.from("beatbox_stories").select("id,author_id,status_text,media_path,media_type,audience,created_at,expires_at,profiles!beatbox_stories_author_id_fkey(display_name,username,avatar_url)").order("created_at", { ascending: false }).limit(40);
    if (error) { toast.error("Stories are temporarily unavailable."); return; }
    const next = ((data || []) as StoryRow[]).filter(story => new Date(story.expires_at).getTime() > Date.now());
    setStories(next);
    const privatePaths = next.filter(item => item.media_path).map(item => item.media_path!);
    if (!privatePaths.length) { setSignedUrls({}); return; }
    const { data: links } = await supabase.storage.from("story-media").createSignedUrls(privatePaths, 30 * 60);
    setSignedUrls(Object.fromEntries((links || []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl])));
  };

  useEffect(() => { void loadStories(); }, [user?.id]);

  const viewerStories = useMemo<StoryItem[]>(() => stories.map(item => {
    const author = getProfile(item.profiles);
    const mediaType: StoryItem["mediaType"] = item.media_type || "status";
    return { id: item.id, authorId: item.author_id, author: author?.display_name || author?.username || "BeatBox creator", avatarUrl: author?.avatar_url, mediaUrl: item.media_path ? signedUrls[item.media_path] || "" : "", mediaType, caption: item.status_text, expiresAt: item.expires_at };
  }).filter(item => item.mediaType === "status" || Boolean(item.mediaUrl)), [signedUrls, stories]);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { toast.error("Sign in to share a Story."); return; }
    if (!statusText.trim() && !file) { toast.error("Add a short status or select one media file."); return; }
    if (file && file.size > MAX_STORY_BYTES) { toast.error("Story media must be 50 MB or smaller."); return; }
    const mediaType = file ? mediaTypeFor(file) : null;
    if (file && !mediaType) { toast.error("Choose an image, video, or audio file for your Story."); return; }
    setBusy(true); setUploadProgress(0);
    const id = crypto.randomUUID();
    const mediaPath = file ? `${user.id}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}` : null;
    try {
      const { error: storyError } = await supabase.from("beatbox_stories").insert({ id, author_id: user.id, status_text: statusText.trim() || null, media_path: mediaPath, media_type: mediaType, audience });
      if (storyError) throw storyError;
      if (file && mediaPath) await uploadResumable({ bucket: "story-media", objectPath: mediaPath, file, onProgress: percent => setUploadProgress(percent) });
      setStatusText(""); setFile(null); setAudience("public"); setOpen(false); setUploadProgress(0);
      toast.success("Your Story is live for 24 hours.");
      await loadStories();
    } catch (error) {
      await supabase.from("beatbox_stories").delete().eq("id", id).eq("author_id", user.id);
      toast.error(error instanceof Error ? error.message : "Unable to publish Story.");
    } finally { setBusy(false); }
  };

  const markViewed = async (storyId: string) => {
    if (!user) return;
    await supabase.from("beatbox_story_views").upsert({ story_id: storyId, viewer_id: user.id }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true });
  };
  const react = async (storyId: string, reaction: string) => {
    if (!user) { toast.error("Sign in to react to Stories."); return; }
    const result = await supabase.from("beatbox_story_reactions").upsert({ story_id: storyId, user_id: user.id, reaction }, { onConflict: "story_id,user_id" });
    if (result.error) toast.error("Your Story reaction could not be saved.");
  };

  return <section className="story-rail" aria-label="BeatBox Stories">
    <div className="story-rail__header"><div><p className="eyebrow"><span /> Stories</p><h2>24 hours of what is moving</h2></div><span className="muted-copy"><Volume2 size={14} /> Story audio plays when opened</span></div>
    <div className="story-rail__items">
      <button type="button" className="story-rail__item story-rail__item--add" onClick={() => user ? setOpen(current => !current) : toast.error("Sign in to add a Story.")}><span className="story-rail__avatar"><Plus size={20} /></span><strong>Your Story</strong></button>
      {viewerStories.map((story, index) => <button type="button" className="story-rail__item" key={story.id} onClick={() => setViewerIndex(index)}><span className="story-rail__avatar">{story.avatarUrl ? <img src={story.avatarUrl} alt="" /> : story.author.slice(0, 1).toUpperCase()}</span><strong>{story.author}</strong></button>)}
      {!viewerStories.length && <p className="story-rail__empty">Be the first creator to share a 24-hour update.</p>}
    </div>
    {open && <form className="story-composer" onSubmit={publish}><div><b>Share a Story</b><small>Disappears after 24 hours. Video and audio play with sound after someone opens your Story.</small></div><textarea value={statusText} onChange={event => setStatusText(event.target.value)} maxLength={600} rows={2} placeholder={`What is happening, ${profile?.display_name || "creator"}?`} disabled={busy} /><div className="story-composer__controls"><label className="file-input file-input--compact"><ImagePlus size={15} /><b>{file ? file.name : "Image, video, or audio"}</b><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/mp4" onChange={event => setFile(event.target.files?.[0] || null)} disabled={busy} /></label><label className="feed-composer__privacy"><span>Audience</span><select value={audience} onChange={event => setAudience(event.target.value as StoryRow["audience"])} disabled={busy}><option value="public">Public</option><option value="friends">Friends</option><option value="only_me">Only me</option></select></label><button className="button button--small" disabled={busy || (!statusText.trim() && !file)}>{busy ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}{busy ? `${uploadProgress || "Publishing"}%` : "Share Story"}</button></div></form>}
    {viewerIndex !== null && <StoryViewer stories={viewerStories} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} onView={markViewed} onReact={react} />}
  </section>;
}
