import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

describe("BeatBox secure download boundary", () => {
  it("requires a verified authenticated entitlement before signing paid master files", async () => {
    const edge = await source("supabase/functions/secure-download/index.ts");

    expect(edge).toContain("admin.auth.getUser(token)");
    expect(edge).toContain('.eq("buyer_id", auth.user.id)');
    expect(edge).toContain('["payment_verified", "delivered"]');
    expect(edge).toContain('if (asset.access_mode === "paid_download")');
    expect(edge).toContain('from("content_orders")');
    expect(edge).toContain('createSignedUrl(asset.original_path, 300');
    expect(edge).toContain('test(data.master_url)');
    expect(edge).toContain('if (payload.preview)');
    expect(edge).toContain('from("content-previews")');
    expect(edge).toContain('if (asset.access_mode === "stream_only")');
  });

  it("keeps master delivery behind a JWT-protected Edge Function rather than browser storage access", async () => {
    const client = await source("client/src/lib/marketplace.ts");
    const edge = await source("supabase/functions/secure-download/index.ts");

    expect(client).toContain('supabase.functions.invoke("secure-download"');
    expect(client).not.toContain('from("beat-masters").createSignedUrl');
    expect(edge).toContain('const token = bearer.startsWith("Bearer ")');
    expect(edge).toContain('admin.auth.getUser(token)');
  });

  it("does not create a Stripe simulation or automatic payment-success state", async () => {
    const dashboard = await source("client/src/pages/Dashboards.tsx");
    const paymentPanel = await source("client/src/components/PaymentRequestPanel.tsx");

    expect(dashboard).not.toMatch(/stripe|payment_intent|checkout session/i);
    expect(paymentPanel).not.toMatch(/stripe|payment_intent|checkout session/i);
    expect(paymentPanel).toMatch(/Mobile Money|Orange Money|WhatsApp/i);
  });

  it("keeps beat upload minimal and protects the single main audio file", async () => {
    const dashboards = await source("client/src/pages/Dashboards.tsx");
    const marketplace = await source("client/src/lib/marketplace.ts");

    expect(dashboards).toContain("const [cover, setCover]");
    expect(dashboards).toContain("const [beatFile, setBeatFile]");
    expect(dashboards).toContain("title");
    expect(dashboards).not.toContain("previewFile");
    expect(marketplace).toContain("beat-masters");
    expect(marketplace).toContain("requestSecureDownload");
  });

  it("keeps trigger helpers private and exposes only reviewed authenticated payment and tag RPCs", async () => {
    const hardening = await source("supabase/migrations/20260811_beatbox_rpc_hardening.sql");
    const triggerHardening = await source("supabase/migrations/20260811_beatbox_trigger_search_path.sql");

    expect(hardening).toContain("create table if not exists public.public_profiles");
    expect(hardening).toContain("alter table public.public_profiles enable row level security");
    expect(hardening).toContain("revoke execute on function public.handle_new_user() from public, anon, authenticated");
    expect(triggerHardening).toContain("alter function public.handle_new_user() set search_path = ''");
    expect(hardening).toContain("revoke execute on function public.attach_tags_to_beat(uuid, text[]) from public, anon");
    expect(hardening).toContain("grant execute on function public.create_payment_request(uuid, text, text, text) to authenticated");
    expect(hardening).toContain("grant execute on function public.review_payment_request(uuid, public.order_status) to authenticated");
  });
});
