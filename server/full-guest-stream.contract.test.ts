import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("full guest streaming controls", () => {
  it("exposes a clear full-stream play action without a guest download route", () => {
    const player = read("client/src/components/AudioPreview.tsx");
    const card = read("client/src/components/BeatCard.tsx");

    expect(player).toContain('"Play full stream"');
    expect(player).toContain("Full stream · No sign-in needed to listen");
    expect(card).toContain("Play the full beat");
    expect(card).toContain('streamBeatId={beat.id}');
    expect(card).toContain("downloads require sign-in and, for paid beats, verified entitlement");
    expect(card).not.toContain("requestSecureDownload(");
  });

  it("keeps signed master downloads behind the secure entitlement function", () => {
    const marketplace = read("client/src/lib/marketplace.ts");
    const secureDownload = read("supabase/functions/secure-download/index.ts");

    expect(marketplace).toContain('supabase.functions.invoke("secure-download"');
    expect(secureDownload).toContain('in("status", ["payment_verified", "delivered"])');
    expect(secureDownload).toContain('const bucket = asset.is_content ? "content-masters" : "beat-masters"');
  });

  it("uses a controlled public stream endpoint for listings that need a playable source", () => {
    const player = read("client/src/components/AudioPreview.tsx");
    const edge = read("supabase/functions/guest-stream/index.ts");

    expect(player).toContain('supabase.functions.invoke("guest-stream"');
    expect(edge).toContain('eq("status", "published")');
    expect(edge).toContain("createSignedUrl(path, 120)");
    expect(edge).toContain("full_stream: true");
  });
});
