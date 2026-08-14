import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("BeatBox full-stream and download entitlement boundary", () => {
  it("keeps every new beat master separate from its public full-stream copy at upload time", () => {
    const dashboard = read("client/src/pages/Dashboards.tsx");
    const creatorHub = read("client/src/pages/CreatorHub.tsx");
    expect(dashboard).toContain('upload("beat-masters", beatFile, "beat")');
    expect(dashboard).toContain('upload("beat-previews", beatFile, "stream")');
    expect(dashboard).toContain("separate full-length guest stream");
    expect(dashboard).not.toContain("preview_url: mainBeatPath, master_url: mainBeatPath");
    expect(creatorHub).toContain('bucket: "beat-previews"');
    expect(creatorHub).toContain("Full guest streaming:");
    expect(creatorHub).toContain("preview_url: previewPath, master_url: masterPath");
    expect(creatorHub).not.toContain("preview_url: masterPath, master_url: masterPath");
  });

  it("keeps browser storage signing away from private masters and routes legacy playback through the reviewed stream endpoint", () => {
    const marketplace = read("client/src/lib/marketplace.ts");
    const guestStream = read("supabase/functions/guest-stream/index.ts");
    expect(marketplace).toContain("controlled guest-stream function");
    expect(marketplace).toContain('supabase.storage.from("beat-previews")');
    expect(marketplace).not.toContain('"beat-masters").createSignedUrl');
    expect(guestStream).toContain('eq("status", "published")');
    expect(guestStream).toContain("createSignedUrl(path, 120)");
  });

  it("keeps final downloads behind the verified entitlement function", () => {
    const secureDownload = read("supabase/functions/secure-download/index.ts");
    expect(secureDownload).toContain('in("status", ["payment_verified", "delivered"])');
    expect(secureDownload).toContain('const bucket = asset.is_content ? "content-masters" : "beat-masters"');
    expect(secureDownload).toContain("from(bucket).createSignedUrl");
  });
});
