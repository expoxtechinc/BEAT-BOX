import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("public beat preview controls", () => {
  it("renders a labeled play control for the shared audio preview without an authentication gate", () => {
    const preview = read("client/src/components/AudioPreview.tsx");
    expect(preview).toContain('data-preview-access={publicPreview ? "guest" : "account"}');
    expect(preview).toContain('aria-label={actionLabel}');
    expect(preview).toContain('"Play preview"');
    expect(preview).toContain('className="audio-preview__play-label"');
    expect(preview).toContain('{playing ? "Pause" : "Play"}');
    expect(preview).toContain("Public preview · No sign-in needed to listen");
    expect(preview).not.toContain("if (!user)");
  });

  it("uses the guest preview component on every reusable public beat card", () => {
    const card = read("client/src/components/BeatCard.tsx");
    expect(card).toContain("data-beat-preview={beat.preview_signed_url ? \"available\" : \"unavailable\"}");
    expect(card).toContain("compact={mode === \"grid\"} publicPreview");
    expect(card).toContain("Sign in only to save, download, or request a license.");
  });

  it("keeps public catalog surfaces on the shared beat card and gates secure downloads for guests", () => {
    for (const sourcePath of ["client/src/pages/Home.tsx", "client/src/pages/Explore.tsx", "client/src/pages/Producer.tsx"]) {
      expect(read(sourcePath)).toContain("<BeatCard");
    }
    const detail = read("client/src/pages/BeatDetail.tsx");
    expect(detail).toContain("Anyone can still play this public preview without an account.");
    expect(detail).toContain("requestSecureDownload(beat.id)");
  });
});
