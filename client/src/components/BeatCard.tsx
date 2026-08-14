import { AudioPreview } from "@/components/AudioPreview";
import { money } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { Eye, Headphones, Heart } from "lucide-react";
import { Link } from "wouter";

export function BeatCard({ beat, mode = "grid" }: { beat: Beat; mode?: "grid" | "list" }) {
  return (
    <article className={`beat-card beat-card--${mode}`} data-beat-stream={beat.preview_signed_url ? "available" : "resolvable"}>
      <Link href={`/beats/${beat.slug}`} className="beat-card__cover" aria-label={`Open ${beat.title}`}>
        {beat.cover_url ? <img src={beat.cover_url} alt={`${beat.title} cover art`} loading="lazy" /> : <span className="beat-card__cover-fallback">BB</span>}
        <span className="beat-card__badge">{beat.is_free ? "Free" : money(beat.price)}</span>
      </Link>
      <div className="beat-card__body">
        <div className="beat-card__heading">
          <div>
            <Link href={`/beats/${beat.slug}`} className="beat-card__title">{beat.title}</Link>
            <p className="beat-card__producer">{beat.producer || "BeatBox producer"}</p>
          </div>
          <strong>{beat.is_free ? "Free" : money(beat.price)}</strong>
        </div>
        <p className="beat-card__meta">{[beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.musical_key].filter(Boolean).join(" · ") || "Metadata pending"}</p>
        <AudioPreview src={beat.preview_signed_url} streamBeatId={beat.id} title={beat.title} compact={mode === "grid"} publicPreview />
        <p className="beat-card__preview-note">Play the full beat. Sign in to save it; downloads require sign-in and, for paid beats, verified entitlement.</p>
        <div className="beat-card__stats" aria-label="Beat engagement">
          <span><Headphones size={14} /> {beat.play_count ?? 0} plays</span>
          <span><Heart size={14} /> {beat.favorite_count ?? 0}</span>
          <span><Eye size={14} /> {beat.download_count ?? 0} downloads</span>
        </div>
      </div>
    </article>
  );
}
