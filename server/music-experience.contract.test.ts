import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const charts = readFileSync(resolve(root, "client/src/pages/Charts.tsx"), "utf8");
const shell = readFileSync(resolve(root, "client/src/components/MarketplaceShell.tsx"), "utf8");
const audio = readFileSync(resolve(root, "client/src/components/AudioPreview.tsx"), "utf8");
const saved = readFileSync(resolve(root, "client/src/pages/SavedItems.tsx"), "utf8");

describe("Mobile music experience contracts", () => {
  it("adds a routed, data-backed chart without inventing ranked releases", () => {
    expect(app).toContain('path="/charts" component={Charts}');
    expect(charts).toContain('loadPublishedBeatPage({ pageSize: 24 })');
    expect(charts).toContain("(beat.play_count || 0) * 3");
    expect(charts).toContain("(beat.favorite_count || 0) * 5");
    expect(charts).toContain("(beat.download_count || 0) * 8");
    expect(charts).toContain('streamBeatId={beat.id}');
    expect(charts).not.toContain("Paddy K");
  });

  it("keeps discovery shelves and creator spotlights based on published BeatBox data", () => {
    expect(home).toContain("loadPublishedBeats");
    expect(home).toContain("topProducers");
    expect(home).toContain("Recently released");
    expect(home).toContain("Popular on BeatBox");
    expect(home).toContain("beat.play_count || 0");
    expect(home).toContain('href="/charts"');
  });

  it("provides one compact, accessible mobile navigation and a real active-playback toggle", () => {
    expect((shell.match(/<nav className="mobile-bottom-nav"/g) || []).length).toBe(1);
    expect(shell).toContain('href="/charts"');
    expect(shell).toContain('href="/search"');
    expect(shell).toContain('href={user ? "/saved" : "/auth"}');
    expect(shell).toContain('"beatbox:toggle-active-playback"');
    expect(audio).toContain('"beatbox:playback"');
    expect(audio).toContain('"beatbox:toggle-active-playback"');
  });

  it("keeps the library private and surfaces truthful saved-item state", () => {
    expect(saved).toContain("Private library");
    expect(saved).toContain("saved item");
    expect(saved).toContain('.eq("user_id", user.id)');
    expect(saved).toContain('.eq("social_posts.status", "published")');
  });
});
