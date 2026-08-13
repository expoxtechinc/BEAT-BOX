import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Vercel production contract", () => {
  it("uses the frozen build and public output directory", () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
    expect(config.buildCommand).toContain("pnpm check");
    expect(config.buildCommand).toContain("pnpm build");
    expect(config.installCommand).toContain("pnpm install --frozen-lockfile");
    expect(config.outputDirectory).toBe("dist/public");
    expect(config.routes).toEqual([
      expect.objectContaining({ src: "/api/(.*)", dest: "/api/index" }),
      expect.objectContaining({ handle: "filesystem" }),
      expect.objectContaining({ src: "/(.*)", dest: "/index.html" }),
    ]);
    const handler = fs.readFileSync(path.join(root, "api/index.ts"), "utf8");
    expect(handler).toContain("createApp");
    expect(handler).not.toContain("VITE_GEMINI_API_KEY");
    const clientTransport = fs.readFileSync(path.join(root, "client/src/main.tsx"), "utf8");
    expect(clientTransport).toContain("content-type");
    expect(clientTransport).toContain("BeatBox AI endpoint is unavailable in this deployment.");
  });

  it("keeps the serverless API entrypoint and SEO assets in the deployable source", () => {
    expect(fs.existsSync(path.join(root, "api/index.ts"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "client/public/google7c2d5df9354788c6.html"), "utf8")).toContain("google-site-verification");
    expect(fs.readFileSync(path.join(root, "client/public/robots.txt"), "utf8")).toContain("Sitemap:");
    expect(fs.readFileSync(path.join(root, "client/public/sitemap.xml"), "utf8")).toContain("https://beat-box-org.vercel.app");
  });
});
