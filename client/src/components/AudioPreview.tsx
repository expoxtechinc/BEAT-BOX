import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { recordEngagement } from "@/lib/engagement";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";
import "./AudioPreview.css";

type AudioPreviewProps = {
  src?: string | null;
  title: string;
  compact?: boolean;
  engagementSubjectId?: string;
  publicPreview?: boolean;
  streamBeatId?: string;
};

export function AudioPreview({
  src,
  title,
  compact = false,
  engagementSubjectId,
  publicPreview = true,
  streamBeatId,
}: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [resolvedSrc, setResolvedSrc] = useState(src || null);
  const [streamState, setStreamState] = useState<"ready" | "loading" | "unavailable">(src ? "ready" : "loading");
  const [streamMessage, setStreamMessage] = useState<string | null>(null);

  useEffect(() => {
    setResolvedSrc(src || null);
    setStreamState(src ? "ready" : "loading");
    setStreamMessage(null);
    setPlaying(false);
    setProgress(0);
    playTracked.current = false;
  }, [src, streamBeatId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && resolvedSrc) {
      audio.pause();
      return;
    }

    let source = resolvedSrc;
    if (!source) {
      if (!streamBeatId) {
        setStreamState("unavailable");
        setStreamMessage("Audio is still processing. Please try again shortly.");
        return;
      }
      setStreamState("loading");
      setStreamMessage("Preparing the full stream…");
      const { data, error } = await supabase.functions.invoke("guest-stream", { body: { beat_id: streamBeatId } });
      if (error || !data?.url) {
        setStreamState("unavailable");
        setStreamMessage(data?.error || "This beat cannot stream yet. Please try again after the producer updates its audio.");
        return;
      }
      const streamUrl = data.url as string;
      source = streamUrl;
      setResolvedSrc(streamUrl);
      setStreamState("ready");
      setStreamMessage(null);
      audio.src = streamUrl;
      audio.load();
    }
    await audio.play();
  };

  const actionLabel = `${playing ? "Pause" : "Play full stream"} for ${title}`;

  return (
    <div className={`audio-preview ${compact ? "audio-preview--compact" : ""}`} data-preview-access={publicPreview ? "guest" : "account"} data-beat-stream={resolvedSrc ? "available" : streamState}>
      <audio
        ref={audioRef}
        src={resolvedSrc || undefined}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          if (engagementSubjectId && !playTracked.current) {
            playTracked.current = true;
            void recordEngagement("beat", engagementSubjectId, "play").catch(() => undefined);
          }
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onError={() => {
          setPlaying(false);
          setStreamState("unavailable");
          setStreamMessage("The audio stream could not play. Please try again shortly.");
        }}
        onTimeUpdate={event => setProgress((event.currentTarget.currentTime / event.currentTarget.duration || 0) * 100)}
      />
      <button type="button" className="audio-preview__play" onClick={() => void toggle()} aria-label={actionLabel} title={actionLabel} aria-busy={streamState === "loading" && !resolvedSrc}>
        {playing ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
        <span className="audio-preview__play-label">{playing ? "Pause" : "Play"}</span>
      </button>
      <div className="audio-preview__track-wrap">
        <div className="audio-preview__track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        {!compact && <span className={`audio-preview__caption ${publicPreview ? "audio-preview__caption--public" : ""}`}>{streamMessage || (publicPreview ? "Full stream · No sign-in needed to listen" : "Watermarked stream")}</span>}
      </div>
      <button type="button" className="audio-preview__mute" onClick={() => setVolume(value => (value > 0 ? 0 : 0.8))} aria-label="Toggle stream volume">
        {volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
      {!compact && <input className="audio-preview__volume" aria-label="Stream volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} />}
    </div>
  );
}
