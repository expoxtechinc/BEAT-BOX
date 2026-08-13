import { ChevronLeft, ChevronRight, Heart, MessageCircle, Pause, Play, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type StoryItem = {
  id: string;
  author: string;
  avatarUrl?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string | null;
};

const STORY_DURATION_MS = 5000;
const REACTIONS = ["❤️", "🔥", "👏", "😂"];

export function StoryViewer({ stories, initialIndex = 0, onClose, onReact }: { stories: StoryItem[]; initialIndex?: number; onClose: () => void; onReact?: (storyId: string, reaction: string) => void }) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(stories.length - 1, 0)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const story = stories[index];
  const progressBars = useMemo(() => stories.map((item, itemIndex) => ({ ...item, itemIndex })), [stories]);

  useEffect(() => {
    if (!story || paused) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const nextProgress = Math.min(1, (Date.now() - started) / STORY_DURATION_MS);
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        window.clearInterval(timer);
        if (index < stories.length - 1) { setIndex(current => current + 1); setReaction(null); setProgress(0); }
        else onClose();
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [index, paused, story, stories.length, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex(current => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex(current => Math.min(stories.length - 1, current + 1));
      if (event.key === " ") { event.preventDefault(); setPaused(current => !current); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stories.length]);

  if (!story) return null;
  const selectReaction = (value: string) => { setReaction(value); onReact?.(story.id, value); };
  return <div className="story-viewer" role="dialog" aria-modal="true" aria-label="BeatBox stories">
    <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Close stories"><X size={22} /></button>
    <div className="story-viewer__progress" aria-label={`Story ${index + 1} of ${stories.length}`}>
      {progressBars.map(item => <button type="button" className="story-viewer__progress-segment" key={item.id} onClick={() => { setIndex(item.itemIndex); setProgress(0); setReaction(null); }} aria-label={`Open story ${item.itemIndex + 1}`}><span style={{ width: `${item.itemIndex < index ? 100 : item.itemIndex === index ? progress * 100 : 0}%` }} /></button>)}
    </div>
    <header className="story-viewer__header"><div className="story-viewer__avatar">{story.avatarUrl ? <img src={story.avatarUrl} alt="" /> : story.author.slice(0, 1).toUpperCase()}</div><div><strong>{story.author}</strong><small>BeatBox story · now</small></div><button type="button" className="story-viewer__pause" onClick={() => setPaused(current => !current)} aria-label={paused ? "Play story" : "Pause story"}>{paused ? <Play size={18} /> : <Pause size={18} />}</button></header>
    <div className="story-viewer__stage" onClick={() => setPaused(current => !current)}>{story.mediaType === "video" ? <video src={story.mediaUrl} autoPlay muted loop playsInline /> : <img src={story.mediaUrl} alt={story.caption || `${story.author} story`} />}<button type="button" className="story-viewer__nav story-viewer__nav--left" onClick={event => { event.stopPropagation(); setIndex(current => Math.max(0, current - 1)); setProgress(0); }} aria-label="Previous story"><ChevronLeft /></button><button type="button" className="story-viewer__nav story-viewer__nav--right" onClick={event => { event.stopPropagation(); setIndex(current => Math.min(stories.length - 1, current + 1)); setProgress(0); }} aria-label="Next story"><ChevronRight /></button>{story.caption && <p className="story-viewer__caption">{story.caption}</p>}</div>
    <div className="story-viewer__actions"><div className="story-viewer__reactions" aria-label="Quick reactions">{REACTIONS.map(item => <button type="button" key={item} className={reaction === item ? "is-active" : ""} onClick={() => selectReaction(item)} aria-label={`React ${item}`}>{item}</button>)}</div><button type="button" aria-label="Comment on story"><MessageCircle size={19} /></button><button type="button" aria-label="Share story"><Send size={19} /></button><button type="button" aria-label="Like story" className={reaction === "❤️" ? "is-active" : ""} onClick={() => selectReaction("❤️")}><Heart size={19} /></button></div>
  </div>;
}

export type { StoryItem };
