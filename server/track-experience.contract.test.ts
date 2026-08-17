import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const beatDetail = readFileSync(resolve(root, "client/src/pages/BeatDetail.tsx"), "utf8");
const audioPreview = readFileSync(resolve(root, "client/src/components/AudioPreview.tsx"), "utf8");
const trackStyles = readFileSync(resolve(root, "client/src/styles/track-experience.css"), "utf8");

describe("BeatBox track listening experience", () => {
  it("keeps full guest streaming and protected download behavior visible", () => {
    expect(beatDetail).toContain("streamBeatId={beat.id}");
    expect(beatDetail).toContain("publicPreview");
    expect(beatDetail).toContain("requestSecureDownload(beat.id)");
    expect(beatDetail).toContain("Sign in to receive a secure download");
    expect(audioPreview).toContain("waveform?: boolean");
    expect(audioPreview).toContain("Full stream · No sign-in needed to listen");
  });

  it("renders data-backed release actions and context instead of invented engagement", () => {
    expect(beatDetail).toContain("beat.like_count || 0");
    expect(beatDetail).toContain("beat.view_count || 0");
    expect(beatDetail).toContain("beat.favorite_count || 0");
    expect(beatDetail).toContain("supabase.from(\"beat_likes\")");
    expect(beatDetail).toContain("supabase.from(\"favorites\")");
    expect(beatDetail).toContain("subject_type: \"beat\"");
    expect(beatDetail).toContain("relatedPage.beats.filter");
    expect(beatDetail).toContain("supabase.from(\"beat_comments\")");
  });

  it("uses a scoped original BeatBox visual system for the listening room", () => {
    expect(beatDetail).toContain("track-hero");
    expect(beatDetail).toContain("track-waveform");
    expect(beatDetail).toContain("track-actions");
    expect(beatDetail).toContain("track-license");
    expect(trackStyles).toContain(".track-hero");
    expect(trackStyles).toContain(".track-waveform");
    expect(trackStyles).toContain("@media (max-width: 620px)");
  });
});
