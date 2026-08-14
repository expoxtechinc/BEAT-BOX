import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Stream service is not configured" }, 503);

  let payload: { beat_id?: string };
  try { payload = await request.json(); } catch { return json({ error: "A beat identifier is required" }, 400); }
  if (!payload.beat_id) return json({ error: "A beat identifier is required" }, 400);

  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: beat, error } = await admin
    .from("beats")
    .select("id,preview_url,master_url")
    .eq("id", payload.beat_id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !beat?.master_url) return json({ error: "This beat is not available for playback" }, 404);

  // New releases use a dedicated stream object in beat-previews. Legacy releases
  // whose fields match are streamed inline from their released master source.
  const useDedicatedStream = Boolean(beat.preview_url && beat.preview_url !== beat.master_url && !/^https?:\/\//i.test(beat.preview_url));
  const bucket = useDedicatedStream ? "beat-previews" : "beat-masters";
  const path = useDedicatedStream ? beat.preview_url! : beat.master_url;
  if (/^https?:\/\//i.test(path)) return json({ error: "This beat needs a creator media update before it can stream" }, 409);

  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(path, 120);
  if (signedError || !signed?.signedUrl) return json({ error: "The stream link could not be created" }, 500);

  return json({ url: signed.signedUrl, expires_in: 120, full_stream: true });
});
