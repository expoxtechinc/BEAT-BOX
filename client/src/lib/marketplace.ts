import type { Beat, BeatLicense, Category } from "./models";
import { supabase } from "./supabase";

const externalUrl = (value: string) => /^https?:\/\//i.test(value);

export async function toDisplayBeat(beat: Beat): Promise<Beat> {
  // A paid master is never an acceptable browser preview. Older listings that
  // reused the master path intentionally show no audio until the seller adds a
  // separate preview, rather than exposing a private original through a link.
  const safePreviewPath = beat.preview_url && (beat.is_free || beat.preview_url !== beat.master_url)
    ? beat.preview_url
    : null;
  const [cover, preview] = await Promise.all([
    beat.cover_image_url
      ? externalUrl(beat.cover_image_url)
        ? Promise.resolve({ data: { signedUrl: beat.cover_image_url } })
        : supabase.storage.from("beat-covers").createSignedUrl(beat.cover_image_url, 60 * 60)
      : Promise.resolve({ data: { signedUrl: null } }),
    safePreviewPath
      ? externalUrl(safePreviewPath)
        ? Promise.resolve({ data: { signedUrl: safePreviewPath } })
        : supabase.storage.from("beat-previews").createSignedUrl(safePreviewPath, 60 * 10)
      : Promise.resolve({ data: { signedUrl: null } }),
  ]);

  return {
    ...beat,
    cover_url: cover.data?.signedUrl ?? null,
    preview_signed_url: preview.data?.signedUrl ?? null,
  };
}

export async function loadPublishedBeats(filters?: {
  search?: string;
  genre?: string;
  mood?: string;
  minBpm?: number;
  maxBpm?: number;
}) {
  let query = supabase
    .from("beats")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);

  if (filters?.genre && filters.genre !== "all") query = query.eq("genre", filters.genre);
  if (filters?.mood && filters.mood !== "all") query = query.eq("mood", filters.mood);
  if (filters?.search?.trim()) {
    const safeSearch = filters.search.replace(/[,%()]/g, " ").trim();
    if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,producer.ilike.%${safeSearch}%,genre.ilike.%${safeSearch}%`);
  }
  if (filters?.minBpm) query = query.gte("bpm", filters.minBpm);
  if (filters?.maxBpm) query = query.lte("bpm", filters.maxBpm);

  const { data, error } = await query;
  if (error) throw error;
  return Promise.all(((data ?? []) as Beat[]).map(toDisplayBeat));
}

export async function loadBeatBySlug(slug: string) {
  const { data, error } = await supabase.from("beats").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? toDisplayBeat(data as Beat) : null;
}

export async function loadCategories() {
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function loadLicenses(beatId: string) {
  const { data, error } = await supabase
    .from("beat_licenses")
    .select("id, beat_id, license_code, name, price, terms, is_available")
    .eq("beat_id", beatId)
    .eq("is_available", true)
    .order("price");
  if (error) throw error;
  return (data ?? []) as BeatLicense[];
}

export async function requestSecureDownload(beatId: string) {
  const { data, error } = await supabase.functions.invoke("secure-download", { body: { beat_id: beatId } });
  if (error) throw error;
  return data as { url: string; expires_in: number };
}

export const money = (amount: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount ?? 0));
