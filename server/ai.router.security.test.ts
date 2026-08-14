import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("BeatBox AI security boundary", () => {
  it("keeps provider secrets out of browser source and uses protected chat", () => {
    const router = read("server/aiRouter.ts");
    const client = read("client/src/pages/AI.tsx");
    expect(router).toContain("protectedProcedure.input(chatInputSchema)");
    expect(router).toContain("process.env.GEMINI_API_KEY");
    expect(router).toContain("process.env.GROQ_API_KEY");
    expect(router).toContain("process.env.OPENROUTER_API_KEY");
    expect(client).not.toContain("GEMINI_API_KEY");
    expect(client).not.toContain("GROQ_API_KEY");
    expect(client).not.toContain("OPENROUTER_API_KEY");
  });

  it("bounds user context and keeps the Vercel API function present", () => {
    const router = read("server/aiRouter.ts");
    const handler = read("api/trpc/[trpc].ts");
    expect(router).toContain(".max(12)");
    expect(router).toContain("maxOutputTokens: 900");
    expect(router).toContain("max_tokens: 900");
    expect(handler).toContain("createExpressMiddleware");
    expect(handler).toContain("createContext");
  });

  it("forwards an active Supabase session and verifies it server-side before protected AI access", () => {
    const client = read("client/src/main.tsx");
    const context = read("server/_core/context.ts");
    expect(client).toContain("supabase.auth.getSession()");
    expect(client).toContain("`Bearer ${token}`");
    expect(context).toContain("/auth/v1/user");
    expect(context).toContain("authenticateSupabaseBearer");
    expect(context).not.toContain("decodeJwt");
  });
});
