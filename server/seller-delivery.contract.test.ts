import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260814_beatbox_seller_delivery_handoff.sql"), "utf8");
const dashboard = readFileSync(resolve(root, "client/src/pages/Dashboards.tsx"), "utf8");

describe("seller-controlled WhatsApp delivery handoff", () => {
  it("allows a delivered status only after a verified payment and records truthful buyer notice", () => {
    expect(migration).toContain("'delivered'");
    expect(migration).toContain("v_current_order_status <> 'payment_verified'");
    expect(migration).toContain("Only a payment-verified order can be marked delivered");
    expect(migration).toContain("after their WhatsApp handoff");
  });

  it("keeps delivery seller-controlled and exposes clear dashboard guidance", () => {
    expect(migration).toContain("auth.uid() <> v_seller_id");
    expect(dashboard).toContain("Mark delivered");
    expect(dashboard).toContain("WhatsApp conversation");
  });
});
