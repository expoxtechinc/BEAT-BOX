import { describe, expect, it } from "vitest";
import { createOlderBeatCursorFilter, normalizeCatalogPageSize } from "../client/src/lib/marketplace";
import { readFileSync } from "node:fs";

describe("scalable BeatBox catalog pagination", () => {
  it("keeps each page bounded while permitting catalog traversal beyond sixty beats", () => {
    expect(normalizeCatalogPageSize()).toBe(24);
    expect(normalizeCatalogPageSize(500)).toBe(60);
    expect(normalizeCatalogPageSize(1)).toBe(1);
    expect(normalizeCatalogPageSize(0)).toBe(1);
  });

  it("uses a deterministic compound cursor for older rows sharing a timestamp", () => {
    expect(createOlderBeatCursorFilter({ createdAt: "2026-08-14T12:00:00.000Z", id: "7a6a6ca4-e368-4ecf-9765-b10a93f77862" })).toBe("created_at.lt.2026-08-14T12:00:00.000Z,and(created_at.eq.2026-08-14T12:00:00.000Z,id.lt.7a6a6ca4-e368-4ecf-9765-b10a93f77862)");
  });

  it("uses cursor pagination instead of a fixed sixty-row catalog limit", () => {
    const loader = readFileSync("client/src/lib/marketplace.ts", "utf8");
    const explore = readFileSync("client/src/pages/Explore.tsx", "utf8");
    expect(loader).toContain('.order("created_at", { ascending: false })');
    expect(loader).toContain('.order("id", { ascending: false })');
    expect(loader).toContain('.limit(pageSize + 1)');
    expect(loader).toContain("createOlderBeatCursorFilter(options.cursor)");
    expect(explore).toContain("Load older beats");
    expect(explore).toContain("more older beats available");
  });
});
