import { AudioPreview } from "@/components/AudioPreview";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadPublishedBeatPage } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { ArrowRight, BarChart3, Loader2, Play, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

function chartScore(beat: Beat) {
  return (beat.play_count || 0) * 3 + (beat.favorite_count || 0) * 5 + (beat.download_count || 0) * 8;
}

export default function Charts() {
  usePageMeta("BeatBox charts", "Explore public BeatBox charts ordered by real listening, saving, and download activity.");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState("all");

  useEffect(() => {
    let active = true;
    void loadPublishedBeatPage({ pageSize: 24 })
      .then(page => { if (active) setBeats(page.beats); })
      .catch(() => { if (active) setBeats([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const genres = useMemo(() => ["all", ...Array.from(new Set(beats.map(beat => beat.genre?.trim()).filter(Boolean) as string[])).slice(0, 6)], [beats]);
  const chart = useMemo(() => beats
    .filter(beat => genre === "all" || beat.genre === genre)
    .sort((a, b) => chartScore(b) - chartScore(a) || (b.created_at || "").localeCompare(a.created_at || "") || a.id.localeCompare(b.id))
    .slice(0, 12), [beats, genre]);

  return <section className="music-page charts-page"><div className="container">
    <header className="music-page__intro">
      <p className="eyebrow"><span /> BeatBox charts</p>
      <div><h1>What listeners are returning to.</h1><p>Ranked from real BeatBox plays, saved favorites, and completed downloads. No paid placement or invented positions.</p></div>
    </header>
    <div className="music-chip-row" aria-label="Chart categories">
      {genres.map(value => <button type="button" key={value} className={genre === value ? "is-active" : ""} aria-pressed={genre === value} onClick={() => setGenre(value)}>{value === "all" ? "All sounds" : value}</button>)}
    </div>
    {loading ? <div className="charts-loading"><Loader2 className="spin" /><span>Building the latest chart…</span></div> : chart.length ? <div className="chart-list">
      {chart.map((beat, index) => <article className="chart-row" key={beat.id}>
        <span className="chart-row__position">{index + 1}</span>
        <Link className="chart-row__cover" href={`/beats/${beat.slug}`} aria-label={`Open ${beat.title}`}>{beat.cover_url ? <img src={beat.cover_url} alt="" /> : <BarChart3 aria-hidden="true" />}</Link>
        <div className="chart-row__main"><Link href={`/beats/${beat.slug}`}>{beat.title}</Link><span>{beat.producer || "BeatBox producer"}</span><small>{beat.genre || "Open format"}{beat.bpm ? ` · ${beat.bpm} BPM` : ""}</small></div>
        <div className="chart-row__stream"><AudioPreview compact title={beat.title} src={beat.preview_signed_url} streamBeatId={beat.id} engagementSubjectId={beat.id} /></div>
        <Link className="chart-row__open" href={`/beats/${beat.slug}`} aria-label={`Open ${beat.title}`}><Play size={16} fill="currentColor" /></Link>
      </article>)}
    </div> : <div className="empty-featured empty-featured--dark"><TrendingUp size={30} /><h2>No published beats match this chart yet.</h2><p>Choose another category or return when creators publish new music.</p><Link href="/explore" className="button button--small">Browse all beats <ArrowRight size={15} /></Link></div>}
  </div></section>;
}
