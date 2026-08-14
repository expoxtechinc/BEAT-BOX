import { AudioPreview } from "@/components/AudioPreview";
import { PaymentRequestPanel } from "@/components/PaymentRequestPanel";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { recordEngagement } from "@/lib/engagement";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadBeatBySlug, loadLicenses, money, requestSecureDownload } from "@/lib/marketplace";
import type { Beat, BeatLicense } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import { Download, Eye, Flag, Heart, Loader2, MessageCircle, ShoppingBag, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles?: Array<{ display_name: string | null; username?: string | null }> | null;
};

export default function BeatDetail() {
  const [, params] = useRoute("/beats/:slug");
  const { user } = useSupabaseAuth();
  const [beat, setBeat] = useState<Beat | null>(null);
  const [licenses, setLicenses] = useState<BeatLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Copyright concern");
  const [reportDescription, setReportDescription] = useState("");
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const viewedBeatId = useRef<string | null>(null);

  usePageMeta(beat?.title || "Beat", beat?.description || "Stream and license an original beat on BeatBox.");

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    loadBeatBySlug(params.slug)
      .then(async current => {
        setBeat(current);
        if (current) {
          const options = await loadLicenses(current.id);
          setLicenses(options);
          setSelected(options[0]?.id ?? null);
        }
      })
      .catch(() => setBeat(null))
      .finally(() => setLoading(false));
  }, [params?.slug]);

  useEffect(() => {
    if (!beat || !user || viewedBeatId.current === beat.id) return;
    viewedBeatId.current = beat.id;
    void recordEngagement("beat", beat.id, "view")
      .then(counted => {
        if (counted) setBeat(current => current ? { ...current, view_count: (current.view_count || 0) + 1 } : current);
      })
      .catch(() => undefined);
  }, [beat?.id, user?.id]);

  useEffect(() => {
    if (!beat) return;
    let active = true;
    void Promise.all([
      user ? supabase.from("beat_likes").select("beat_id").eq("beat_id", beat.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("beat_comments").select("id,body,created_at,user_id,profiles(display_name,username)").eq("beat_id", beat.id).order("created_at", { ascending: true }).limit(100),
    ]).then(([likeResult, commentsResult]) => {
      if (!active) return;
      setLiked(Boolean(likeResult.data));
      setComments((commentsResult.data || []) as Comment[]);
    });
    return () => { active = false; };
  }, [beat?.id, user?.id]);

  const addToCart = async () => {
    if (!user || !beat) return setNotice("Sign in to add this beat to your cart.");
    const { error } = await supabase.from("cart_items").upsert({ user_id: user.id, beat_id: beat.id, license_id: selected }, { onConflict: "user_id,beat_id,license_id" });
    setNotice(error ? error.message : "Added to your cart.");
  };

  const download = async () => {
    if (!beat) return;
    if (!user) return setNotice("Sign in to receive a secure download. Anyone can still stream this full public release without an account.");
    setNotice("Preparing a short-lived private download link…");
    try {
      const result = await requestSecureDownload(beat.id);
      window.location.assign(result.url);
      setNotice(`Secure link created. It expires in ${Math.round(result.expires_in / 60)} minutes.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A verified entitlement is required before this master can be downloaded.");
    }
  };

  const favorite = async () => {
    if (!user || !beat) return setNotice("Sign in to save a favorite.");
    const { error } = await supabase.from("favorites").upsert({ user_id: user.id, beat_id: beat.id }, { onConflict: "user_id,beat_id", ignoreDuplicates: true });
    setNotice(error ? error.message : "Saved to your favorites.");
  };

  const toggleLike = async () => {
    if (!user || !beat) return setNotice("Sign in to like this beat.");
    const wasLiked = liked;
    setLiked(!wasLiked);
    setBeat(current => current ? { ...current, like_count: Math.max(0, (current.like_count || 0) + (wasLiked ? -1 : 1)) } : current);
    const response = wasLiked
      ? await supabase.from("beat_likes").delete().eq("beat_id", beat.id).eq("user_id", user.id)
      : await supabase.from("beat_likes").insert({ beat_id: beat.id, user_id: user.id });
    if (response.error) {
      setLiked(wasLiked);
      setBeat(current => current ? { ...current, like_count: Math.max(0, (current.like_count || 0) + (wasLiked ? 1 : -1)) } : current);
      setNotice(response.error.message);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !beat) return setNotice("Sign in to add a comment.");
    const body = commentDraft.trim();
    if (!body) return;
    setCommentBusy(true);
    const { data, error } = await supabase.from("beat_comments").insert({ beat_id: beat.id, user_id: user.id, body }).select("id,body,created_at,user_id,profiles(display_name,username)").single();
    setCommentBusy(false);
    if (error) return setNotice(error.message);
    setComments(current => [...current, data as Comment]);
    setBeat(current => current ? { ...current, comment_count: (current.comment_count || 0) + 1 } : current);
    setCommentDraft("");
  };

  const report = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !beat) return setNotice("Sign in to report content.");
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, reported_beat_id: beat.id, reason: reportReason, description: reportDescription || null });
    setNotice(error ? error.message : "Report submitted to BeatBox moderation.");
    if (!error) { setReportOpen(false); setReportDescription(""); }
  };

  if (loading) return <section className="status-page"><Loader2 className="spin" /><p>Loading beat details…</p></section>;
  if (!beat) return <section className="status-page"><h1>This beat is unavailable.</h1><Link className="button" href="/explore">Browse available beats</Link></section>;

  return <section className="beat-detail"><div className="container beat-detail__grid">
    <div className="beat-detail__cover">{beat.cover_url ? <img src={beat.cover_url} alt={`${beat.title} cover art`} /> : <span>BB</span>}</div>
    <div className="beat-detail__main">
      <p className="eyebrow"><span /> {beat.genre || "Original beat"}</p>
      <h1>{beat.title}</h1>
      <Link className="producer-link" href={`/producers/${beat.seller_id}`}>by {beat.producer || "BeatBox producer"}</Link>
      <p className="beat-detail__description">{beat.description || "The producer has not added a description for this beat yet."}</p>
      <div className="metadata-row"><span>{beat.bpm || "—"} BPM</span><span>{beat.musical_key || "Key pending"}</span><span>{beat.mood || "Original mood"}</span></div>
      <AudioPreview src={beat.preview_signed_url} streamBeatId={beat.id} title={beat.title} engagementSubjectId={beat.id} />
      <div className="beat-detail__engagement"><span><Eye size={15} /> {beat.view_count || 0} views</span><span>{beat.play_count || 0} plays</span><span><Heart size={15} /> {beat.like_count || 0} likes</span><span><MessageCircle size={15} /> {beat.comment_count || 0} comments</span><span>{beat.favorite_count || 0} saves</span></div>
      <div className="beat-detail__actions"><button className={`text-button ${liked ? "is-liked" : ""}`} onClick={() => void toggleLike()}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}</button><button className="text-button" onClick={() => void favorite()}><Heart size={16} /> Save</button><button className="text-button" onClick={() => setReportOpen(value => !value)}><Flag size={16} /> Report</button></div>
      <section className="beat-comments" aria-label="Beat comments"><div className="beat-comments__heading"><h2>Comments</h2><span>{beat.comment_count || comments.length}</span></div>{comments.length ? <div className="beat-comments__list">{comments.map(comment => <article key={comment.id} className="beat-comment"><strong>{comment.profiles?.[0]?.display_name || comment.profiles?.[0]?.username || "BeatBox listener"}</strong><p>{comment.body}</p><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time></article>)}</div> : <p className="beat-comments__empty">No comments yet. Be the first to start a conversation.</p>}<form className="beat-comment-form" onSubmit={addComment}><textarea aria-label="Add a comment" maxLength={2000} rows={2} value={commentDraft} onChange={event => setCommentDraft(event.target.value)} placeholder={user ? "Add a thoughtful comment…" : "Sign in to join the conversation"} disabled={!user || commentBusy} /><button className="button button--small" disabled={!user || !commentDraft.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post comment"}</button></form></section>
      {reportOpen && <form className="report-form" onSubmit={report}><label>Reason<select value={reportReason} onChange={event => setReportReason(event.target.value)}><option>Copyright concern</option><option>Misleading listing</option><option>Inappropriate content</option><option>Other</option></select></label><label>Details (optional)<textarea rows={2} value={reportDescription} onChange={event => setReportDescription(event.target.value)} /></label><button className="button button--small">Submit report</button></form>}
    </div>
    <aside className="license-card"><div className="license-card__heading"><div><p className="eyebrow"><span /> License options</p><h2>Choose your use</h2></div><strong>{beat.is_free ? "Free" : money(beat.price)}</strong></div>{licenses.length ? <div className="license-options">{licenses.map(option => <label className={selected === option.id ? "license-option is-selected" : "license-option"} key={option.id}><input type="radio" name="license" checked={selected === option.id} onChange={() => setSelected(option.id)} /><span><b>{option.name}</b><small>{option.terms || "License details available at checkout."}</small></span><strong>{money(option.price)}</strong></label>)}</div> : <p className="license-note">The producer’s available license terms will appear here.</p>}{beat.is_free ? <button className="button license-card__button" type="button" onClick={() => void download()}><Download size={17} /> Get secure free download</button> : <><button className="button license-card__button" type="button" onClick={() => void addToCart()}><ShoppingBag size={17} /> Add to cart</button><button className="button button--outline license-card__button" type="button" onClick={() => setPaymentOpen(value => !value)}>Buy now / request payment</button></>}{notice && <p className="form-success"><ShieldCheck size={16} />{notice}</p>}{paymentOpen && !beat.is_free && <PaymentRequestPanel beat={beat} />}</aside>
  </div></section>;
}
