import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("PWA installation and feedback adoption controls", () => {
  it("places the shared adoption controls prominently on the homepage", () => {
    const home = read("client/src/pages/Home.tsx");
    expect(home).toContain('import { PwaAdoptionBanner } from "@/components/PwaAdoptionBanner"');
    expect(home).toContain("<PwaAdoptionBanner />");
  });

  it("uses the browser install lifecycle while preserving platform guidance", () => {
    const component = read("client/src/components/PwaAdoptionBanner.tsx");
    expect(component).toContain('window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)');
    expect(component).toContain('window.addEventListener("appinstalled", onInstalled)');
    expect(component).toContain('event.preventDefault()');
    expect(component).toContain('Install BeatBox');
    expect(component).toContain('Add to Home Screen');
    expect(component).toContain('Install app');
  });

  it("requests only genuine feedback and keeps the store action unavailable until a real listing URL is configured", () => {
    const component = read("client/src/components/PwaAdoptionBanner.tsx");
    expect(component).toContain("Your honest feedback helps us improve the music community.");
    expect(component).toContain("VITE_PLAY_STORE_URL");
    expect(component).toContain("Play Store reviews will be available after the official listing launches.");
    expect(component).toContain('window.open(playStoreUrl, "_blank", "noopener,noreferrer")');
    expect(component).not.toMatch(/five-star|5-star|five star|5 star/i);
  });

  it("persists dismissals and keeps the responsive prompt styling in the global application stylesheet", () => {
    const component = read("client/src/components/PwaAdoptionBanner.tsx");
    expect(component).toContain("beatbox:pwa-install-dismissed");
    expect(component).toContain("beatbox:rating-prompt-dismissed");
    const styles = read("client/src/index.css");
    expect(styles).toContain(".pwa-adoption");
    expect(styles).toContain(".pwa-adoption__card--rating");
  });
});
