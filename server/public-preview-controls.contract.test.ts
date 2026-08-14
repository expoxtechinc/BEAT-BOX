import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("public beat stream controls", () => {
  it("renders a labeled full-stream play control without an authentication gate", () => {
    const preview = read("client/src/components/AudioPreview.tsx");
    expect(preview).toContain('data-preview-access={publicPreview ? "guest" : "account"}');
    expect(preview).toContain('aria-label={actionLabel}');
    expect(preview).toContain('"Play full stream"');
    expect(preview).toContain('className="audio-preview__play-label"');
    expect(preview).toContain('{playing ? "Pause" : "Play"}');
    expect(preview).toContain("Full stream · No sign-in needed to listen");
    expect(preview).not.toContain("if (!user)");
  });

  it("uses the guest stream component on every reusable public beat card", () => {
    const card = read("client/src/components/BeatCard.tsx");
    expect(card).toContain("data-beat-stream={beat.preview_signed_url ? \"available\" : \"resolvable\"}");
    expect(card).toContain('streamBeatId={beat.id}');
    expect(card).toContain("compact={mode === \"grid\"} publicPreview");
    expect(card).toContain("downloads require sign-in and, for paid beats, verified entitlement.");
  });

  it("keeps public catalog surfaces on the shared beat card and gates secure downloads for guests", () => {
    for (const sourcePath of ["client/src/pages/Home.tsx", "client/src/pages/Explore.tsx", "client/src/pages/Producer.tsx"]) {
      expect(read(sourcePath)).toContain("<BeatCard");
    }
    const detail = read("client/src/pages/BeatDetail.tsx");
    expect(detail).toContain("Anyone can still stream this full public release without an account.");
    expect(detail).toContain("requestSecureDownload(beat.id)");
  });

  it("refreshes stale mobile clients so legacy cards receive the universal play control", () => {
    const main = read("client/src/main.tsx");
    expect(main).toContain('register("/sw.js", { updateViaCache: "none" })');
    expect(main).toContain('navigator.serviceWorker.addEventListener("controllerchange"');
    expect(main).toContain("window.location.reload()");

    const config = read("vite.config.ts");
    expect(config).toContain("skipWaiting: true");
    expect(config).toContain("cleanupOutdatedCaches: true");
  });
});
