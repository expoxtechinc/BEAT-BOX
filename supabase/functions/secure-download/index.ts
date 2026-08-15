import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type DownloadRequest = { beat_id?: string; content_id?: string; preview?: boolean };
type ProtectedAsset = { id: string; title: string; original_path: string; preview_path?: string | null; access_mode: string; content_type: string; currency: string; is_content: boolean; beat_id: string | null; order_id: string | null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"); const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Download service is not configured" }, 503);
  const bearer = request.headers.get("Authorization") || ""; const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!token) return json({ error: "Authentication is required" }, 401);
  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Your session could not be verified" }, 401);
  let payload: DownloadRequest; try { payload = await request.json(); } catch { return json({ error: "A beat or content identifier is required" }, 400); }
  if (!payload.beat_id && !payload.content_id) return json({ error: "A beat or content identifier is required" }, 400);

  let asset: ProtectedAsset;
  if (payload.content_id) {
    const { data, error } = await admin.from("content_items").select("id,title,original_path,preview_path,access_mode,content_type,currency").eq("id", payload.content_id).eq("status", "published").maybeSingle();
    if (error || !data?.original_path) return json({ error: "This content is not available for secure delivery" }, 404);
    asset = { ...data, is_content: true, beat_id: null, order_id: null };
  } else {
    const { data, error } = await admin.from("beats").select("id,title,is_free,master_url,access_mode,content_type,currency,download_enabled").eq("id", payload.beat_id).eq("status", "published").maybeSingle();
    if (error || !data?.master_url || /^https?:\/\//i.test(data.master_url) || data.download_enabled === false) return json({ error: "This beat is not available for secure delivery" }, 404);
    // `is_free` is the listing's authoritative commercial policy. Favor it over
    // legacy access-mode rows that were accidentally stored as paid downloads.
    asset = { id: data.id, title: data.title, original_path: data.master_url, access_mode: data.is_free ? "free_download" : (data.access_mode || "paid_download"), content_type: data.content_type || "audio", currency: data.currency || "USD", is_content: false, beat_id: data.id, order_id: null };
  }
  if (payload.preview) {
    if (!asset.is_content || !asset.preview_path) return json({ error: "A preview is not available for this item" }, 404);
    const { data: preview, error: previewError } = await admin.storage.from("content-previews").createSignedUrl(asset.preview_path, 120);
    if (previewError || !preview?.signedUrl) return json({ error: "The preview link could not be created" }, 500);
    return json({ url: preview.signedUrl, expires_in: 120, content_type: asset.content_type, preview: true });
  }
  if (asset.access_mode === "stream_only") return json({ error: "This item is stream-only and has no download entitlement" }, 403);

  if (asset.access_mode === "paid_download") {
    const query = asset.beat_id
      ? admin.from("orders").select("id").eq("buyer_id", auth.user.id).eq("beat_id", asset.beat_id).in("status", ["payment_verified", "delivered"]).order("verified_at", { ascending: false }).limit(1)
      : admin.from("content_orders").select("id").eq("buyer_id", auth.user.id).eq("content_id", asset.id).in("status", ["payment_verified", "delivered"]).order("verified_at", { ascending: false }).limit(1);
    const { data: order, error: orderError } = await query.maybeSingle();
    if (orderError || !order) return json({ error: "No verified payment entitlement exists for this item" }, 403);
    asset.order_id = order.id;
  }
  const bucket = asset.is_content ? "content-masters" : "beat-masters";
  const filename = `${asset.title.replace(/[^a-z0-9_-]+/gi, "-").replace(/(^-|-$)/g, "") || "beatbox-content"}-BeatBox-original`;
  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(asset.original_path, 300, { download: filename });
  if (signedError || !signed?.signedUrl) return json({ error: "The secure download link could not be created" }, 500);
  if (asset.beat_id) await admin.from("downloads").insert({ user_id: auth.user.id, beat_id: asset.beat_id, order_id: asset.order_id });
  else {
    const { data: current } = await admin.from("content_items").select("download_count").eq("id", asset.id).maybeSingle();
    await admin.from("content_items").update({ download_count: Number(current?.download_count || 0) + 1 }).eq("id", asset.id);
  }
  return json({ url: signed.signedUrl, expires_in: 300, content_type: asset.content_type });
});
