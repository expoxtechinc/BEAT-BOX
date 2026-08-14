import { BeatCard } from "@/components/BeatCard";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadCategories, loadPublishedBeatPage, type BeatCatalogCursor } from "@/lib/marketplace";
import type { Beat, Category } from "@/lib/models";
import { Grid2X2, List, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

const CATALOG_PAGE_SIZE = 24;

export default function Explore() {
  usePageMeta("Browse beats", "Search BeatBox by genre, mood, BPM, and producer to find an original beat for your next track.");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<BeatCatalogCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [mood, setMood] = useState("all");
  const [minBpm, setMinBpm] = useState("");
  const [maxBpm, setMaxBpm] = useState("");
  const [mode, setMode] = useState<"grid" | "list">("grid");

  const filters = () => ({ search, genre, mood, minBpm: Number(minBpm) || undefined, maxBpm: Number(maxBpm) || undefined });
  const refresh = async () => {
    setLoading(true); setError(null); setNextCursor(null);
    try {
      const page = await loadPublishedBeatPage({ filters: filters(), pageSize: CATALOG_PAGE_SIZE });
      setBeats(page.beats); setNextCursor(page.nextCursor); setHasMore(page.hasMore);
    } catch {
      setBeats([]); setHasMore(false); setError("BeatBox could not load the catalog. Please try again.");
    } finally { setLoading(false); }
  };
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError(null);
    try {
      const page = await loadPublishedBeatPage({ filters: filters(), cursor: nextCursor, pageSize: CATALOG_PAGE_SIZE });
      setBeats(current => [...current, ...page.beats.filter(beat => !current.some(existing => existing.id === beat.id))]);
      setNextCursor(page.nextCursor); setHasMore(page.hasMore);
    } catch { setError("Older beats could not load. Please try again."); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => { loadCategories().then(setCategories).catch(() => setCategories([])); refresh(); }, []);

  return <section className="explore-page"><div className="container"><div className="page-intro"><p className="eyebrow"><span /> Discover the catalog</p><h1>Find your next sound.</h1><p>Search original beats by mood, genre, and tempo. Guests can stream every published release; private master downloads remain protected until sign-in and entitlement are verified.</p></div><form className="filters" onSubmit={event => { event.preventDefault(); refresh(); }}><div className="search-field"><Search size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, producer, or genre" aria-label="Search beats" /></div><select value={genre} onChange={event => setGenre(event.target.value)}><option value="all">All genres</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select><select value={mood} onChange={event => setMood(event.target.value)}><option value="all">Any mood</option><option value="Chill">Chill</option><option value="Dark">Dark</option><option value="Energetic">Energetic</option><option value="Soulful">Soulful</option></select><input type="number" value={minBpm} onChange={event => setMinBpm(event.target.value)} placeholder="Min BPM" min="40" max="260" /><input type="number" value={maxBpm} onChange={event => setMaxBpm(event.target.value)} placeholder="Max BPM" min="40" max="260" /><button className="button button--small" type="submit"><SlidersHorizontal size={16} /> Apply</button></form><div className="catalog-toolbar"><p>{loading ? "Loading catalog…" : `${beats.length.toLocaleString()} loaded${hasMore ? " — more older beats available" : ""}`}</p><div className="view-toggle"><button className={mode === "grid" ? "is-active" : ""} type="button" onClick={() => setMode("grid")} aria-label="Grid view"><Grid2X2 size={18} /></button><button className={mode === "list" ? "is-active" : ""} type="button" onClick={() => setMode("list")} aria-label="List view"><List size={18} /></button></div></div>{loading ? <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, index) => <div className="skeleton-card" key={index} />)}</div> : beats.length ? <><div className={mode === "grid" ? "beat-grid" : "beat-list"}>{beats.map(beat => <BeatCard key={beat.id} beat={beat} mode={mode} />)}</div><div className="catalog-load-more"><p>{hasMore ? "New releases stay at the top. Load older beats whenever you are ready." : "You have reached the oldest published beats."}</p>{hasMore && <button className="button button--outline" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <><LoaderCircle size={17} className="is-spinning" /> Loading older beats…</> : "Load older beats"}</button>}</div></> : <div className="empty-featured empty-featured--light"><Search size={32} /><h2>{error ?? "No published beats match those filters."}</h2><p>{error ? "Check your connection and try again." : "Try a broader search or return later as producers grow the catalog."}</p>{error && <button className="button button--small" type="button" onClick={refresh}>Try again</button>}</div>}{error && beats.length > 0 && <div className="catalog-load-more catalog-load-more--error"><p>{error}</p><button className="button button--outline" type="button" onClick={loadMore}>Try again</button></div>}</div></section>;
}
