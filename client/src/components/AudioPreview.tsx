import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { recordEngagement } from "@/lib/engagement";
import { useEffect, useRef, useState } from "react";

export function AudioPreview({ src, title, compact = false, engagementSubjectId }: { src?: string | null; title: string; compact?: boolean; engagementSubjectId?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  if (!src) {
    return <span className="preview-unavailable">Preview will be available after the producer uploads it.</span>;
  }

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className={`audio-preview ${compact ? "audio-preview--compact" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => { setPlaying(true); if (engagementSubjectId && !playTracked.current) { playTracked.current = true; void recordEngagement("beat", engagementSubjectId, "play").catch(() => undefined); } }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={event => setProgress((event.currentTarget.currentTime / event.currentTarget.duration || 0) * 100)}
      />
      <button type="button" className="audio-preview__play" onClick={() => void toggle()} aria-label={`${playing ? "Pause" : "Play"} ${title}`}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="audio-preview__track-wrap">
        <div className="audio-preview__track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        {!compact && <span className="audio-preview__caption">Watermarked preview</span>}
      </div>
      <button type="button" className="audio-preview__mute" onClick={() => setVolume(value => (value > 0 ? 0 : 0.8))} aria-label="Toggle volume">
        {volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
      {!compact && <input className="audio-preview__volume" aria-label="Preview volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} />}
    </div>
  );
}
