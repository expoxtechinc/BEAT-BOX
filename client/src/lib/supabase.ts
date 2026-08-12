import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * The public shell must remain renderable when a Vercel project has not yet
 * received its Supabase build variables. Queries will return their normal
 * error/empty states until the owner configures these values, but a missing
 * variable must never blank the entire application at module-import time.
 */
export const isSupabaseConfigured = Boolean(configuredUrl && configuredPublishableKey);
export const supabaseConfigurationMessage = isSupabaseConfigured
  ? ""
  : "Supabase is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.";

export const supabaseUrl = configuredUrl || "https://placeholder.supabase.co";
const supabasePublishableKey = configuredPublishableKey || "beatbox-missing-supabase-key";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const BEATBOX_LOGO_URL = "https://cdn.phototourl.com/free/2026-08-11-b48b27bd-a5a9-4363-9b97-eacdce958524.png";

/** Logs only structured Supabase error metadata during local development. */
export function logSupabaseError(operation: string, error: unknown) {
  if (!import.meta.env.DEV || !error || typeof error !== "object") return;
  const candidate = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error(`[BeatBox:${operation}]`, {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details,
    hint: candidate.hint,
  });
}
