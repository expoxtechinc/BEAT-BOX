import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("WhatsApp commerce and offline-lite contracts", () => {
  it("keeps public WhatsApp opt-in and payment-reference state truthful in the migration", () => {
    const migration = read("supabase/migrations/20260814_beatbox_whatsapp_payment_handoff.sql");
    expect(migration).toContain("whatsapp_public boolean not null default false");
    expect(migration).toContain("case when p.whatsapp_public then p.whatsapp_number else null end");
    expect(migration).toContain("create_payment_request_v2");
    expect(migration).toContain("'payment_submitted'");
    expect(migration).not.toContain("payment_verified')");
  });

  it("requires buyer-supplied amount, reference, and time before WhatsApp handoff", () => {
    const panel = read("client/src/components/PaymentRequestPanel.tsx");
    expect(panel).toContain("p_submitted_amount");
    expect(panel).toContain("p_payment_sent_at");
    expect(panel).toContain("p_reference: reference");
    expect(panel).toContain("Payment reference submitted for seller review");
    expect(panel).toContain("window.location.assign(whatsappUrl");
    expect(panel).not.toContain('setMessage("Payment successful');
  });

  it("keeps authenticated and mutation routes out of the offline public cache", () => {
    const worker = read("client/public/sw.js");
    expect(worker).toContain('"/api/"');
    expect(worker).toContain('"/messages"');
    expect(worker).toContain('"/account"');
    expect(worker).toContain("request.mode === \"navigate\"");
  });
});
