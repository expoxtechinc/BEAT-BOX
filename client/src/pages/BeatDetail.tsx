import { AudioPreview } from "@/components/AudioPreview";
import { BeatCard } from "@/components/BeatCard";
import { PaymentRequestPanel } from "@/components/PaymentRequestPanel";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { recordEngagement } from "@/lib/engagement";
import { loadBeatBySlug, loadLicenses, loadPublishedBeatPage, money, requestSecureDownload } from "@/lib/marketplace";
import type { Beat, BeatLicense } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import { Copy, Download, Eye, Flag, Heart, Link2, Loader2, MessageCircle, Share2, ShoppingBag, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useRoute } from "wouter";
import "../styles/track-experience.css";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles?: Array<{ display_name: string | null; username?: string | null }> | null;
};

const WAVEFORM_BARS = [42, 58, 36, 72, 49, 66, 31, 82, 55, 38, 67, 47, 76, 45, 61, 33, 79, 54, 40, 68, 52, 88, 44, 63, 35, 74, 51, 69, 43, 80, 57, 38, 65, 48, 73, 46, 60, 34, 77, 53, 42, 70, 48, 86, 56, 39, 67, 50];

export default function BeatDetail() {
  const [, params] = useRoute("/beats/:slug");
  const { user } = useSupabaseAuth();
  const [beat, setBeat] = useState<Beat | null>(null);
  const [related, setRelated] = useState<Beat[]>([]);
  const [licenses, setLicenses] = useState<BeatLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Copyright concern");
  const [reportDescription, setReportDescription] = useState("");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const viewedBeatId = useRef<string | null>(null);

  usePageMeta(beat?.title || "Beat", beat?.description || "Stream and license an original beat on BeatBox.");

  useEffect(() => {
    if (!params?.slug) return;
    let active = true;
    setLoading(true);
    setRelated([]);
    loadBeatBySlug(params.slug)
      .then(async current => {
        if (!active) return;
        setBeat(current);
        if (!current) return;
        const [options, relatedPage] = await Promise.all([
          loadLicenses(current.id),
          loadPublishedBeatPage({ filters: { genre: current.genre || "all" }, pageSize: 8 }),
        ]);
        if (!active) return;
        setLicenses(options);
        setSelected(options[0]?.id ?? null);
        setRelated(relatedPage.beats.filter(item => item.id !== current.id).slice(0, 6));
      })
      .catch(() => {
        if (active) setBeat(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
      user ? supabase.from("favorites").select("beat_id").eq("beat_id", beat.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("beat_comments").select("id,body,created_at,user_id,profiles(display_name,username)").eq("beat_id", beat.id).order("created_at", { ascending: true }).limit(100),
    ]).then(([likeResult, favoriteResult, commentsResult]) => {
      if (!active) return;
      setLiked(Boolean(likeResult.data));
      setSaved(Boolean(favoriteResult.data));
      setComments((commentsResult.data || []) as Comment[]);
    });
    return () => {
      active = false;
    };
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

  const toggleFavorite = async () => {
    if (!user || !beat) return setNotice("Sign in to save this release.");
    const nextSaved = !saved;
    setSaved(nextSaved);
    setBeat(current => current ? { ...current, favorite_count: Math.max(0, (current.favorite_count || 0) + (nextSaved ? 1 : -1)) } : current);
    const response = nextSaved
      ? await supabase.from("favorites").upsert({ user_id: user.id, beat_id: beat.id }, { onConflict: "user_id,beat_id", ignoreDuplicates: true })
      : await supabase.from("favorites").delete().eq("user_id", user.id).eq("beat_id", beat.id);
    if (response.error) {
      setSaved(!nextSaved);
      setBeat(current => current ? { ...current, favorite_count: Math.max(0, (current.favorite_count || 0) + (nextSaved ? -1 : 1)) } : current);
      setNotice(response.error.message);
    }
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

  const share = async () => {
    if (!beat) return;
    const url = `${window.location.origin}/beats/${beat.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: beat.title, text: `Listen to ${beat.title} by ${beat.producer || "a BeatBox producer"}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Release link copied to your clipboard.");
      }
    } catch {
      setNotice("Sharing was canceled or unavailable on this device.");
    }
  };

  const addComment = async (event: FormEvent) => {
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

  const report = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !beat) return setNotice("Sign in to report content.");
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, subject_type: "beat", subject_id: beat.id, reason: reportReason, description: reportDescription || null });
    setNotice(error ? error.message : "Report submitted to BeatBox moderation.");
    if (!error) {
      setReportOpen(false);
      setReportDescription("");
    }
  };

  if (loading) return <section className="status-page"><Loader2 className="spin" /><p>Loading beat details…</p></section>;
  if (!beat) return <section className="status-page"><h1>This beat is unavailable.</h1><Link className="button" href="/explore">Browse available beats</Link></section>;

  const releaseDate = beat.created_at ? new Date(beat.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Release date pending";
  const meta = [beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key, beat.mood].filter(Boolean);

  return (
    <section className="beat-detail track-experience">
      <div className="container track-experience__container">
        <div className="track-hero">
          <div className="track-hero__art-wrap">
            <div className="track-hero__art">
              {beat.cover_url ? <img src={beat.cover_url} alt={`${beat.title} cover art`} /> : <span>BB</span>}
              <span className="track-hero__art-glow" aria-hidden="true" />
            </div>
            <div className="track-hero__art-caption"><span>BEATBOX RELEASE</span><strong>{beat.is_free ? "Free stream" : "Licensed release"}</strong></div>
          </div>

          <div className="track-hero__main">
            <div className="track-hero__eyebrow"><span className="track-hero__signal" aria-hidden="true" />{beat.genre || "Original beat"}<span className="track-hero__dot" aria-hidden="true" />{releaseDate}</div>
            <div className="track-hero__heading">
              <div>
                <h1>{beat.title}</h1>
                <Link className="track-hero__producer" href={`/producers/${beat.seller_id}`}><UserPlus size={16} /> {beat.producer || "BeatBox producer"}</Link>
              </div>
              <span className="track-hero__access">{beat.is_free ? "FREE STREAM" : "STREAM + LICENSE"}</span>
            </div>
            <p className="track-hero__description">{beat.description || "An original BeatBox release. Press play to hear the full public stream."}</p>
            <div className="track-hero__tags">{meta.length ? meta.map(item => <span key={item}>{item}</span>) : <span>Metadata pending</span>}</div>
            <div className="track-player-card">
              <div className="track-player-card__topline"><span><span className="track-player-card__live-dot" /> Full release stream</span><small>Guest listening enabled</small></div>
              <div className="track-waveform" aria-hidden="true">{WAVEFORM_BARS.map((height, index) => <i key={`${height}-${index}`} style={{ height: `${height}%` }} />)}</div>
              <AudioPreview src={beat.preview_signed_url} streamBeatId={beat.id} title={beat.title} engagementSubjectId={beat.id} waveform publicPreview />
            </div>
            <div className="track-actions" aria-label="Release actions">
              <button type="button" className={`track-action ${liked ? "is-active" : ""}`} onClick={() => void toggleLike()}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {liked ? "Liked" : "Like"}</button>
              <button type="button" className={`track-action ${saved ? "is-active" : ""}`} onClick={() => void toggleFavorite()}><Link2 size={17} /> {saved ? "Saved" : "Save"}</button>
              <button type="button" className="track-action" onClick={() => void share()}><Share2 size={17} /> Share</button>
              <button type="button" className="track-action" onClick={() => setReportOpen(value => !value)}><Flag size={17} /> Report</button>
            </div>
            <div className="track-stats" aria-label="Release engagement">
              <span><Eye size={15} /> {beat.view_count || 0} views</span><span>{beat.play_count || 0} plays</span><span><Heart size={15} /> {beat.like_count || 0} likes</span><span><MessageCircle size={15} /> {beat.comment_count || comments.length} comments</span><span>{beat.favorite_count || 0} saves</span>
            </div>
          </div>
        </div>

        <div className="track-layout">
          <div className="track-layout__main">
            <section className="track-info-panel" aria-labelledby="release-info-heading">
              <div className="section-heading"><div><p className="eyebrow"><span /> Release context</p><h2 id="release-info-heading">Built for your next record</h2></div><span className="section-heading__mark">BB / 01</span></div>
              <p>{beat.description || "The producer has not added a description for this release yet. Stream the full public version and connect with the producer for licensing details."}</p>
              <div className="track-info-grid"><div><span>Release date</span><strong>{releaseDate}</strong></div><div><span>Genre</span><strong>{beat.genre || "Original"}</strong></div><div><span>Tempo</span><strong>{beat.bpm ? `${beat.bpm} BPM` : "Pending"}</strong></div><div><span>Key / mood</span><strong>{[beat.musical_key, beat.mood].filter(Boolean).join(" · ") || "Pending"}</strong></div></div>
            </section>

            <section className="beat-comments track-comments" aria-label="Beat comments">
              <div className="section-heading"><div><p className="eyebrow"><span /> Community</p><h2>Talk about this release</h2></div><span className="section-heading__count">{beat.comment_count || comments.length} comments</span></div>
              {comments.length ? <div className="beat-comments__list">{comments.map(comment => <article key={comment.id} className="beat-comment"><div className="beat-comment__avatar">{(comment.profiles?.[0]?.display_name || comment.profiles?.[0]?.username || "B").slice(0, 1).toUpperCase()}</div><div><strong>{comment.profiles?.[0]?.display_name || comment.profiles?.[0]?.username || "BeatBox listener"}</strong><p>{comment.body}</p><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time></div></article>)}</div> : <p className="beat-comments__empty">No comments yet. Be the first to start a conversation.</p>}
              <form className="beat-comment-form" onSubmit={addComment}><textarea aria-label="Add a comment" maxLength={2000} rows={2} value={commentDraft} onChange={event => setCommentDraft(event.target.value)} placeholder={user ? "Add a thoughtful comment…" : "Sign in to join the conversation"} disabled={!user || commentBusy} /><button className="button button--small" disabled={!user || !commentDraft.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post comment"}</button></form>
            </section>

            {related.length > 0 && <section className="related-releases" aria-labelledby="related-heading"><div className="section-heading"><div><p className="eyebrow"><span /> Keep listening</p><h2 id="related-heading">More in {beat.genre || "this sound"}</h2></div><Link href="/explore" className="section-heading__link">Browse all <Copy size={15} /></Link></div><div className="related-releases__grid">{related.map(item => <BeatCard key={item.id} beat={item} mode="list" />)}</div></section>}
          </div>

          <aside className="license-card track-license"><div className="license-card__heading"><div><p className="eyebrow"><span /> Access & license</p><h2>Choose your use</h2></div><strong>{beat.is_free ? "Free" : money(beat.price)}</strong></div><p className="track-license__note"><ShieldCheck size={16} /> Stream the full release publicly. Download access stays protected.</p>{licenses.length ? <div className="license-options">{licenses.map(option => <label className={selected === option.id ? "license-option is-selected" : "license-option"} key={option.id}><input type="radio" name="license" checked={selected === option.id} onChange={() => setSelected(option.id)} /><span><b>{option.name}</b><small>{option.terms || "License details available at checkout."}</small></span><strong>{money(option.price)}</strong></label>)}</div> : <p className="license-note">The producer’s available license terms will appear here.</p>}{beat.is_free ? <button className="button license-card__button" type="button" onClick={() => void download()}><Download size={17} /> Get secure free download</button> : <><button className="button license-card__button" type="button" onClick={() => void addToCart()}><ShoppingBag size={17} /> Add to cart</button><button className="button button--outline license-card__button" type="button" onClick={() => setPaymentOpen(value => !value)}>Buy now / request payment</button></>}{notice && <p className="form-success"><ShieldCheck size={16} />{notice}</p>}{paymentOpen && !beat.is_free && <PaymentRequestPanel beat={beat} />}</aside>
        </div>

        {reportOpen && <form className="report-form track-report" onSubmit={report}><label>Reason<select value={reportReason} onChange={event => setReportReason(event.target.value)}><option>Copyright concern</option><option>Misleading listing</option><option>Inappropriate content</option><option>Other</option></select></label><label>Details (optional)<textarea rows={2} value={reportDescription} onChange={event => setReportDescription(event.target.value)} /></label><button className="button button--small">Submit report</button></form>}
      </div>
    </section>
  );
}
