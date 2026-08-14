import type { Beat, BeatLicense, Category } from "./models";
import { supabase } from "./supabase";

const externalUrl = (value: string) => /^https?:\/\//i.test(value);
const DEFAULT_CATALOG_PAGE_SIZE = 24;
const MAX_CATALOG_PAGE_SIZE = 60;

export type BeatCatalogFilters = {
  search?: string;
  genre?: string;
  mood?: string;
  minBpm?: number;
  maxBpm?: number;
};

export type BeatCatalogCursor = { createdAt: string; id: string };

export type PublishedBeatsPage = {
  beats: Beat[];
  nextCursor: BeatCatalogCursor | null;
  hasMore: boolean;
};

export function normalizeCatalogPageSize(value?: number) {
  return Math.min(Math.max(Math.floor(value ?? DEFAULT_CATALOG_PAGE_SIZE), 1), MAX_CATALOG_PAGE_SIZE);
}

export function createOlderBeatCursorFilter(cursor: BeatCatalogCursor) {
  const createdAt = cursor.createdAt.replace(/[^0-9T:.+\-Z]/g, "");
  const id = cursor.id.replace(/[^a-zA-Z0-9\-]/g, "");
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
}

export async function toDisplayBeat(beat: Beat): Promise<Beat> {
  // Dedicated stream copies load immediately. A missing or legacy matching path
  // is resolved on play by the controlled guest-stream function instead.
  const safePreviewPath = beat.preview_url && beat.preview_url !== beat.master_url
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

export async function loadPublishedBeatPage(options?: {
  filters?: BeatCatalogFilters;
  cursor?: BeatCatalogCursor | null;
  pageSize?: number;
}): Promise<PublishedBeatsPage> {
  const filters = options?.filters;
  const pageSize = normalizeCatalogPageSize(options?.pageSize);
  let query = supabase
    .from("beats")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (filters?.genre && filters.genre !== "all") query = query.eq("genre", filters.genre);
  if (filters?.mood && filters.mood !== "all") query = query.eq("mood", filters.mood);
  if (filters?.search?.trim()) {
    const safeSearch = filters.search.replace(/[,%()]/g, " ").trim();
    if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,producer.ilike.%${safeSearch}%,genre.ilike.%${safeSearch}%`);
  }
  if (filters?.minBpm) query = query.gte("bpm", filters.minBpm);
  if (filters?.maxBpm) query = query.lte("bpm", filters.maxBpm);
  if (options?.cursor) query = query.or(createOlderBeatCursorFilter(options.cursor));

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Beat[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const lastBeat = pageRows.at(-1);
  return {
    beats: await Promise.all(pageRows.map(toDisplayBeat)),
    nextCursor: hasMore && lastBeat?.created_at ? { createdAt: lastBeat.created_at, id: lastBeat.id } : null,
    hasMore,
  };
}

// Kept for compact featured surfaces. Catalog pages use loadPublishedBeatPage.
export async function loadPublishedBeats(filters?: BeatCatalogFilters) {
  const result = await loadPublishedBeatPage({ filters, pageSize: MAX_CATALOG_PAGE_SIZE });
  return result.beats;
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
