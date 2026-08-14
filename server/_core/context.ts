import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

type SupabaseAuthUser = {
  id?: string;
  email?: string | null;
  user_metadata?: { full_name?: string; name?: string; user_name?: string };
};

const bearerFrom = (request: { headers: { authorization?: unknown } }) => {
  const header = request.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

/**
 * BeatBox browser accounts are managed by Supabase. Protected tRPC procedures
 * receive the user's short-lived Supabase access token and verify it directly
 * with Supabase Auth. This deliberately does not trust a decoded browser JWT.
 */
async function authenticateSupabaseBearer(request: { headers: { authorization?: unknown } }): Promise<User | null> {
  const token = bearerFrom(request);
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !publishableKey) return null;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const account = (await response.json()) as SupabaseAuthUser;
    if (!account.id) return null;
    const now = new Date();
    const name = account.user_metadata?.full_name || account.user_metadata?.name || account.user_metadata?.user_name || account.email || "BeatBox member";
    return {
      id: 0,
      openId: `supabase_${account.id}`.slice(0, 64),
      name,
      email: account.email ?? null,
      loginMethod: "supabase",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  } catch {
    return null;
  }
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Fall back only to an actively verified Supabase browser session. Public
    // procedures continue to work when neither session format is present.
    user = await authenticateSupabaseBearer(opts.req);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
