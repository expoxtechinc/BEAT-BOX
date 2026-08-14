import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("bulk publishing and creator collections", () => {
  it("keeps the 20-item beat queue resumable, per-item, and entitlement-safe", () => {
    const studio = read("client/src/pages/CreatorHub.tsx");
    expect(studio).toContain("slice(0, 20)");
    expect(studio).toContain("uploadResumable");
    expect(studio).toContain('bucket: "beat-masters"');
    expect(studio).toContain('bucket: "beat-previews"');
    expect(studio).toContain('status: "completed_with_errors"');
    expect(studio).not.toContain("preview: File | null");
    expect(studio).toContain("Full guest streaming:");
    expect(studio).toContain("preview_url: previewPath, master_url: masterPath");
    expect(studio).not.toContain("preview_url: masterPath, master_url: masterPath");
    expect(studio).toContain("master_url: masterPath");
    expect(studio).toContain("is_free: isFree");
    expect(studio).toContain("Each uploaded beat becomes fully playable in the app automatically; no separate preview file is required");
  });

  it("models albums and podcasts as creator-owned collections instead of synthetic content", () => {
    const studio = read("client/src/pages/CreatorHub.tsx");
    const migration = read("supabase/migrations/20260813_beatbox_collections_bulk_publishing.sql");
    expect(studio).toContain("creator_collections");
    expect(studio).toContain("creator_collection_items");
    expect(studio).toContain("collection_type: type");
    expect(migration).toContain("create table if not exists public.creator_collections");
    expect(migration).toContain("create table if not exists public.creator_collection_items");
    expect(migration).toContain("collection_id uuid not null references public.creator_collections");
  });

  it("allows Professional Mode creators to publish only their own beats and storage objects", () => {
    const migration = read("supabase/migrations/20260813_beatbox_creator_beat_publishing_access.sql");
    expect(migration).toContain("seller_id = auth.uid() and public.is_beatbox_creator()");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(migration).toContain("bucket_id = 'beat-masters'");
  });
});
