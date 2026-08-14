export default function Home() {
  return <BeatBoxHome />;
}

import { BeatCard } from "@/components/BeatCard";
import { PwaAdoptionBanner } from "@/components/PwaAdoptionBanner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadPublishedBeats } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { ArrowRight, Disc3, ShieldCheck, UploadCloud, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

function BeatBoxHome() {
  usePageMeta("Discover music with room to move", "BeatBox is a secure beat marketplace for discovering, licensing, and selling original music.");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const featured = useMemo(() => [...beats].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).slice(0, 6), [beats]);
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

  return <>
    <section className="hero-section"><div className="hero-section__glow hero-section__glow--one" /><div className="hero-section__glow hero-section__glow--two" /><div className="container hero-section__grid"><div className="hero-section__content"><p className="eyebrow"><span /> Liberia’s beat marketplace</p><h1>Find the sound<br /><em>that moves</em> your next release.</h1><p className="hero-section__lede">Discover original beats from producers across Liberia and beyond. Stream every released beat in full, license with clarity, and receive files securely.</p><div className="hero-section__actions"><Link href="/explore" className="button button--hero">Browse beats <ArrowRight size={18} /></Link><Link href="/seller" className="button button--ghost">Start selling</Link></div><PwaAdoptionBanner /><div className="hero-section__trust"><span><ShieldCheck size={18} /> Private downloadable masters</span><span><Waves size={18} /> Full guest streaming</span></div></div><div className="hero-visual" aria-hidden="true"><div className="hero-visual__disc"><div className="hero-visual__label">BB</div></div><div className="hero-visual__meter">{Array.from({ length: 12 }).map((_, index) => <span key={index} />)}</div><div className="hero-visual__floating hero-visual__floating--top"><Disc3 size={20} /><div><b>Original sound</b><small>Made to be heard</small></div></div><div className="hero-visual__floating hero-visual__floating--bottom"><b>Secure license</b><span>Ready when you are</span></div></div></div></section>
    <section className="section section--dark"><div className="container"><div className="section-heading"><div><p className="eyebrow"><span /> New in the crate</p><h2>Featured beats</h2></div><Link href="/explore" className="text-link">Explore all <ArrowRight size={16} /></Link></div>{loading ? <div className="skeleton-grid">{Array.from({ length: 3 }).map((_, index) => <div className="skeleton-card" key={index} />)}</div> : featured.length ? <div className="featured-carousel" aria-label="Featured beats">{featured.map(beat => <div className="featured-carousel__item" key={beat.id}><BeatCard beat={beat} /></div>)}</div> : <div className="empty-featured"><Waves size={32} /><h3>The first published beats will appear here.</h3><p>BeatBox is ready for producers to upload full released streams with private downloadable masters.</p><Link href="/seller" className="button button--small">Upload a beat</Link></div>}</div></section>
    {!loading && topProducers.length > 0 && <section className="section producer-showcase"><div className="container"><div className="section-heading"><div><p className="eyebrow"><span /> Producer spotlight</p><h2>Top producers</h2></div><Link href="/producers" className="text-link">Meet producers <ArrowRight size={16} /></Link></div><div className="producer-showcase__grid">{topProducers.map(producer => <Link className="producer-spotlight" href={`/producers/${producer.id}`} key={producer.id}><div className="producer-spotlight__image">{producer.image ? <img src={producer.image} alt="" /> : producer.name.slice(0, 1)}</div><div><b>{producer.name}</b><span>{producer.beats} published {producer.beats === 1 ? "beat" : "beats"}</span></div><ArrowRight size={16} /></Link>)}</div></div></section>}
    <section className="section section--warm"><div className="container how-grid"><div><p className="eyebrow"><span /> A clearer path to release</p><h2>Your sound deserves an honest marketplace.</h2><p className="section-copy">BeatBox streams released beats in full, keeps download entitlement visible, and gives sellers direct control over every listing.</p><Link href="/help" className="button button--outline">How BeatBox works</Link></div><div className="feature-stack"><div><div className="feature-icon"><Waves /></div><h3>Listen in full</h3><p>Play every released beat before you sign in or license it.</p></div><div><div className="feature-icon"><ShieldCheck /></div><h3>Protect downloads</h3><p>Downloadable master files stay behind sign-in and verified entitlement.</p></div><div><div className="feature-icon"><UploadCloud /></div><h3>Sell without waiting</h3><p>Register as a seller and publish when your work is ready.</p></div></div></div></section>
  </>;
}
