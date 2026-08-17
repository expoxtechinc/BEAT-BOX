export default function Home() {
  return <BeatBoxHome />;
}

import { BeatCard } from "@/components/BeatCard";
import { PwaAdoptionBanner } from "@/components/PwaAdoptionBanner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadPublishedBeats } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { ArrowRight, BarChart3, Clock3, Disc3, Library, Search, ShieldCheck, TrendingUp, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

function BeatBoxHome() {
  usePageMeta("Discover music with room to move", "BeatBox is a secure beat marketplace for discovering, licensing, and selling original music.");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState("all");
  const featured = useMemo(() => [...beats].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).slice(0, 8), [beats]);
  const genres = useMemo(() => ["all", ...Array.from(new Set(beats.map(beat => beat.genre?.trim()).filter(Boolean) as string[])).slice(0, 6)], [beats]);
  const genreMatches = useMemo(() => featured.filter(beat => genre === "all" || beat.genre === genre), [featured, genre]);
  const popular = useMemo(() => [...beats].sort((a, b) => ((b.play_count || 0) * 3 + (b.favorite_count || 0) * 5 + (b.download_count || 0) * 8) - ((a.play_count || 0) * 3 + (a.favorite_count || 0) * 5 + (a.download_count || 0) * 8) || (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 5), [beats]);
  const topProducers = useMemo(() => Object.values(beats.reduce<Record<string, { id: string; name: string; beats: number; image: string | null }>>((result, beat) => {
    const current = result[beat.seller_id];
    result[beat.seller_id] = current
      ? { ...current, beats: current.beats + 1 }
      : { id: beat.seller_id, name: beat.producer || "BeatBox producer", beats: 1, image: beat.cover_url || null };
    return result;
  }, {})).sort((a, b) => b.beats - a.beats || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).slice(0, 4), [beats]);

  useEffect(() => {
    loadPublishedBeats().then(setBeats).catch(() => setBeats([])).finally(() => setLoading(false));
  }, []);

  return <div className="music-home">
    <section className="music-home__hero"><div className="container"><div className="music-home__hero-grid"><div><p className="eyebrow"><span /> Liberia’s sound marketplace</p><h1>Find your next<br /><em>favorite sound.</em></h1><p>Stream published BeatBox music in full, discover the people making it, and license securely when you are ready.</p><div className="music-home__actions"><Link href="/explore" className="button button--hero">Browse music <ArrowRight size={17} /></Link><Link href="/search" className="button button--ghost"><Search size={16} /> Search BeatBox</Link></div></div><div className="music-home__signal" aria-hidden="true"><div><Disc3 /><b>Full-stream listening</b><span>Available on published beats</span></div><div><ShieldCheck /><b>Download protected</b><span>Sign-in and entitlement required</span></div></div></div><PwaAdoptionBanner /></div></section>
    <section className="music-home__content"><div className="container">
      <div className="music-chip-row" aria-label="Discover by genre">{genres.map(value => <button type="button" key={value} className={genre === value ? "is-active" : ""} aria-pressed={genre === value} onClick={() => setGenre(value)}>{value === "all" ? "All" : value}</button>)}</div>
      <div className="music-section-heading"><div><p className="eyebrow"><span /> New music</p><h2>Recently released</h2></div><Link href="/explore" aria-label="Browse all music"><ArrowRight size={21} /></Link></div>
      {loading ? <div className="music-shelf music-shelf--loading">{Array.from({ length: 4 }).map((_, index) => <div className="music-shelf__skeleton" key={index} />)}</div> : genreMatches.length ? <div className="music-shelf" aria-label="Recent published beats">{genreMatches.map(beat => <div className="music-shelf__item" key={beat.id}><BeatCard beat={beat} /></div>)}</div> : <div className="empty-featured empty-featured--light"><Waves size={30} /><h3>No beats in this category yet.</h3><p>Try another genre or browse every published BeatBox release.</p><Link href="/explore" className="button button--small">Browse beats</Link></div>}
      {!loading && popular.length > 0 && <section className="music-ranked-section"><div className="music-section-heading"><div><p className="eyebrow"><span /> Listener activity</p><h2>Popular on BeatBox</h2></div><Link href="/charts" aria-label="Open BeatBox charts"><BarChart3 size={21} /></Link></div><div className="music-row-list">{popular.map((beat, index) => <article className="music-row" key={beat.id}><span className="music-row__rank">{index + 1}</span><Link href={`/beats/${beat.slug}`} className="music-row__cover">{beat.cover_url ? <img src={beat.cover_url} alt="" /> : <Waves />}</Link><div className="music-row__copy"><Link href={`/beats/${beat.slug}`}>{beat.title}</Link><span>{beat.producer || "BeatBox producer"}</span></div><span className="music-row__metric"><TrendingUp size={14} /> {beat.play_count || 0}</span></article>)}</div></section>}
      {!loading && topProducers.length > 0 && <section className="music-ranked-section"><div className="music-section-heading"><div><p className="eyebrow"><span /> Creator spotlight</p><h2>From the community</h2></div><Link href="/producers" aria-label="Browse BeatBox creators"><ArrowRight size={21} /></Link></div><div className="creator-rail">{topProducers.map(producer => <Link className="creator-rail__item" href={`/producers/${producer.id}`} key={producer.id}><div>{producer.image ? <img src={producer.image} alt="" /> : producer.name.slice(0, 1)}</div><b>{producer.name}</b><span>{producer.beats} published</span></Link>)}</div></section>}
      <section className="music-utility-grid"><Link href="/charts"><BarChart3 /><span><b>Charts</b><small>Ranked by real engagement</small></span><ArrowRight size={17} /></Link><Link href="/saved"><Library /><span><b>Your library</b><small>Saved posts and references</small></span><ArrowRight size={17} /></Link><Link href="/explore"><Clock3 /><span><b>Full catalog</b><small>Explore every published beat</small></span><ArrowRight size={17} /></Link></section>
    </div></section>
  </div>;
}
