import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("BeatBox free and paid media entitlement boundary", () => {
  it("keeps a paid master separate from its public preview at upload time", () => {
    const dashboard = read("client/src/pages/Dashboards.tsx");
    const creatorHub = read("client/src/pages/CreatorHub.tsx");
    expect(dashboard).toContain("Paid beats require a separate short or watermarked preview");
    expect(dashboard).toContain('upload("beat-masters", beatFile, "beat")');
    expect(dashboard).toContain('upload("beat-previews", form.is_free ? beatFile : previewFile!, "preview")');
    expect(dashboard).not.toContain("preview_url: mainBeatPath, master_url: mainBeatPath");
    expect(creatorHub).toContain("Add a separate public preview for every paid beat");
    expect(creatorHub).toContain('bucket: "beat-previews"');
    expect(creatorHub).toContain("preview_url: previewPath, master_url: masterPath");
    expect(creatorHub).not.toContain("preview_url: masterPath, master_url: masterPath");
  });

  it("does not sign a legacy paid master as a playback preview", () => {
    const marketplace = read("client/src/lib/marketplace.ts");
    expect(marketplace).toContain("beat.is_free || beat.preview_url !== beat.master_url");
    expect(marketplace).toContain('supabase.storage.from("beat-previews")');
    expect(marketplace).not.toContain('"beat-masters").createSignedUrl');
  });

  it("keeps final downloads behind the verified entitlement function", () => {
    const secureDownload = read("supabase/functions/secure-download/index.ts");
    expect(secureDownload).toContain('in("status", ["payment_verified", "delivered"])');
    expect(secureDownload).toContain('const bucket = asset.is_content ? "content-masters" : "beat-masters"');
    expect(secureDownload).toContain("from(bucket).createSignedUrl");
  });
});
