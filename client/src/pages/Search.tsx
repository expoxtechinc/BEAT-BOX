import React, { useEffect, useState } from "react";
import { Disc3, Hash, Loader2, Radio, Search as SearchIcon, UserRound, UsersRound } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";

type Result = { id: string; title: string; kind: string; href: string; description?: string | null };

const discoveryLinks = [
  { href: "/catalog", label: "Browse all beats", description: "Explore published music from BeatBox creators.", icon: Disc3 },
  { href: "/charts", label: "See the charts", description: "Ranked from real BeatBox listener activity.", icon: Radio },
  { href: "/producers", label: "Meet creators", description: "Find public producer and artist profiles.", icon: UsersRound },
];

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setError(null); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const pattern = `%${term.replace(/[%_]/g, "\\$&")}%`;
        const [content, creators, posts, hashtags] = await Promise.all([
          supabase.from("content_items").select("id,title,description,slug,content_type").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(12),
          supabase.from("profiles").select("id,display_name,username,bio").eq("is_public", true).or(`display_name.ilike.${pattern},username.ilike.${pattern},bio.ilike.${pattern}`).limit(8),
          supabase.from("social_posts").select("id,body").eq("status", "published").ilike("body", pattern).limit(8),
          supabase.from("social_hashtags").select("id,tag,post_count").ilike("tag", pattern).limit(8),
        ]);
        const firstError = content.error || creators.error || posts.error || hashtags.error;
        if (firstError) throw firstError;
        setResults([
          ...(content.data ?? []).map(item => ({ id: item.id, title: item.title, description: item.description, kind: item.content_type, href: `/catalog?content=${encodeURIComponent(item.slug || item.id)}` })),
          ...(creators.data ?? []).map(item => ({ id: item.id, title: item.display_name || item.username || "BeatBox creator", description: item.bio, kind: "creator", href: `/producers/${item.id}` })),
          ...(posts.data ?? []).map(item => ({ id: item.id, title: item.body?.slice(0, 90) || "Community post", kind: "post", href: `/feed?post=${item.id}` })),
          ...(hashtags.data ?? []).map(item => ({ id: item.id, title: `#${item.tag}`, description: `${item.post_count || 0} public posts`, kind: "hashtag", href: `/feed?hashtag=${encodeURIComponent(item.tag)}` })),
        ]);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Search is temporarily unavailable."); }
      finally { setLoading(false); }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);
  const showDiscovery = !loading && !error && query.trim().length < 2;

  return <section className="explore-page music-search-page"><div className="container"><div className="page-intro"><p className="eyebrow"><span /> BeatBox discovery</p><h1>Search the whole platform.</h1><p>Find creators, beats, music, videos, reels, products, posts, and hashtags from one public search.</p></div><div className="music-search-card"><div className="search-field" role="search"><SearchIcon size={20} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Artists, beats, posts, and hashtags…" aria-label="Search BeatBox" /></div><p>Search results show only public, published content.</p></div>{showDiscovery && <section className="search-discovery" aria-labelledby="search-discovery-heading"><div className="section-heading"><div><p className="eyebrow"><span /> Start exploring</p><h2 id="search-discovery-heading">Pick up where the music takes you.</h2></div></div><div className="search-discovery-grid">{discoveryLinks.map(({ href, label, description, icon: Icon }) => <Link className="search-discovery-card" href={href} key={href}><Icon size={20} aria-hidden="true" /><span><b>{label}</b><small>{description}</small></span><span aria-hidden="true">↗</span></Link>)}</div></section>}{loading && <div className="status-page"><Loader2 className="spin" /><p>Searching BeatBox…</p></div>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && query.trim().length >= 2 && <div className="search-results" aria-live="polite">{results.length ? results.map(result => <Link className="search-result-card" key={`${result.kind}-${result.id}`} href={result.href}>{result.kind === "creator" ? <UserRound size={18} /> : result.kind === "hashtag" ? <Hash size={18} /> : <SearchIcon size={18} />}<span><small>{result.kind}</small><b>{result.title}</b>{result.description && <em>{result.description}</em>}</span></Link>) : <div className="empty-featured empty-featured--light"><SearchIcon size={30} /><h2>No public matches yet.</h2><p>Try a creator name, beat title, product, post, or hashtag.</p></div>}</div>}</div></section>;
}
