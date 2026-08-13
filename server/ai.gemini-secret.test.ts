import { describe, expect, it } from "vitest";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

describe("BeatBox server-side Gemini credential", () => {
  it.skipIf(!apiKey)("authorizes a lightweight Gemini model metadata request", async () => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey!)}`);
    expect(response.ok, `Gemini model metadata request returned ${response.status}`).toBe(true);
    const payload = await response.json() as { name?: string };
    expect(payload.name).toContain("models/");
  }, 20_000);
});
