import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BadgeCheck, Bookmark, Camera, Loader2, Music2, UserRound } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/lib/supabase";
import { formatUploadSize, uploadResumable } from "@/lib/resumableUpload";

type ProfileRow = { id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null; role: string | null; country: string | null; professional_mode?: boolean | null };
type SavedBeat = { id: string; title: string; content_type: string; price: number | null; currency: string | null; cover_path: string | null; seller_id: string; created_at: string | null };

export default function Profile() {
  usePageMeta("My profile", "Manage your BeatBox profile, avatar, and saved marketplace beats.");
  const { user, loading: authLoading } = useSupabaseAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [savedBeats, setSavedBeats] = useState<SavedBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      const [profileResult, savedResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,bio,avatar_url,role,country,professional_mode").eq("id", user.id).maybeSingle(),
        supabase.from("content_bookmarks").select("content_id,created_at,content_items!inner(id,title,content_type,price,currency,cover_path,seller_id,created_at,status)").eq("user_id", user.id).eq("content_items.status", "published").order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (profileResult.error) setError(profileResult.error.message);
      else setProfile(profileResult.data as ProfileRow | null);
      if (savedResult.error) {
        // Older projects may only have Feed bookmarks. Keep the profile usable and explain the optional catalog table.
        setError((current) => current || "Saved beats are not available until the marketplace bookmarks migration is applied.");
      } else {
        const beats = (savedResult.data || []).map((row) => {
          const item = Array.isArray(row.content_items) ? row.content_items[0] : row.content_items;
          return item && item.status === "published" ? item as SavedBeat : null;
        }).filter(Boolean) as SavedBeat[];
        setSavedBeats(beats);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file for your avatar."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Avatar images must be 5 MB or smaller."); return; }
    if (!navigator.onLine) { setError("You are offline. Avatar uploads require an internet connection."); return; }
    setUploading(true); setUploadProgress(0); setError(null); setMessage(null);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    try {
      await uploadResumable({ bucket: "avatars", objectPath: path, file, onProgress: (percent, uploaded, total) => { setUploadProgress(percent); setMessage(`Uploading avatar ${percent}% · ${formatUploadSize(uploaded)} of ${formatUploadSize(total)}.`); } });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Avatar upload failed. Retry when online."); setUploading(false); return;
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const update = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (update.error) setError(update.error.message);
    else { setProfile(current => current ? { ...current, avatar_url: publicUrl } : current); setMessage("Profile avatar updated."); }
    setUploading(false);
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "BeatBox listener";
  const toggleProfessionalMode = async () => { if (!user || !profile) return; const next = !profile.professional_mode; const { error: updateError } = await supabase.from("profiles").update({ professional_mode: next }).eq("id", user.id); if (updateError) setError(updateError.message); else { setProfile({ ...profile, professional_mode: next }); setMessage(next ? "Professional mode enabled." : "Professional mode disabled."); } };
  const initials = useMemo(() => displayName.slice(0, 2).toUpperCase(), [displayName]);
  if (authLoading || loading) return <section className="status-page"><Loader2 className="spin" /><p>Loading your profile…</p></section>;
  if (!user) return <section className="status-page"><UserRound size={34} /><h1>Sign in to view your profile.</h1><p>Your avatar and saved beats are private to your account.</p><Link className="button" href="/auth">Sign in</Link></section>;

  return <section className="dashboard-page profile-page"><div className="container">
    <div className="dashboard-title"><div><p className="eyebrow"><span /> Your BeatBox profile</p><h1>{displayName}</h1><p className="muted-copy">Manage your public identity and keep your saved marketplace sounds close.</p></div><Link className="button button--small" href="/saved"><Bookmark size={15} /> Saved Feed items</Link></div>
    {message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <div className="profile-grid">
      <article className="dashboard-panel profile-card"><div className="profile-avatar-wrap">{profile?.avatar_url ? <img className="profile-avatar" src={profile.avatar_url} alt={`${displayName} avatar`} /> : <div className="profile-avatar profile-avatar--fallback">{initials}</div>}<label className="avatar-upload" htmlFor="avatar-file"><Camera size={15} /> {uploading ? `Uploading ${uploadProgress}%…` : "Change avatar"}</label>{uploading && <div className="upload-progress profile-upload-progress" aria-live="polite"><div className="upload-progress__label"><span>Avatar upload</span><b>{uploadProgress}%</b></div><progress max="100" value={uploadProgress}>{uploadProgress}%</progress></div>}<input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} /></div><h2>{displayName}</h2><p className="muted-copy">{profile?.bio || "Add a bio from Account settings to tell creators what moves you."}</p><div className="profile-meta"><span>{profile?.role || "listener"}</span>{profile?.professional_mode && <span><BadgeCheck size={13} /> Professional mode</span>}{profile?.country && <span>{profile.country}</span>}<span>{user.email}</span></div><button className="button button--small button--ghost" type="button" onClick={() => void toggleProfessionalMode}>{profile?.professional_mode ? "Turn off professional mode" : "Enable professional mode"}</button><Link className="button button--small" href="/account">Edit profile details</Link></article>
      <article className="dashboard-panel profile-saved"><div className="section-heading"><div><p className="eyebrow"><span /> Private collection</p><h2>Saved beats</h2></div><Music2 size={22} /></div>{savedBeats.length ? <div className="profile-beat-list">{savedBeats.map(beat => <Link className="profile-beat" href={`/beats/${beat.id}`} key={beat.id}>{beat.cover_path ? <img src={supabase.storage.from("content-covers").getPublicUrl(beat.cover_path).data.publicUrl} alt="" /> : <div className="profile-beat__placeholder"><Music2 size={20} /></div>}<span><b>{beat.title}</b><small>{beat.content_type} · {beat.price ? `${beat.currency || "USD"} ${beat.price}` : "Free"}</small></span></Link>)}</div> : <div className="empty-featured empty-featured--light"><Bookmark size={28} /><h3>No saved beats yet.</h3><p>Browse the catalog and save beats you want to revisit.</p><Link className="button button--small" href="/catalog">Browse beats</Link></div>}</article>
    </div>
  </div></section>;
}
