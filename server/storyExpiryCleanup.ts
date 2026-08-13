import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { sdk } from "./_core/sdk";

type ExpiredPath = { path: string };

function cleanupClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase cleanup configuration is missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function runStoryExpiryCleanup(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const client = cleanupClient();
    const { data, error } = await client.rpc("expire_beatbox_stories");
    if (error) throw error;

    const paths = ((data || []) as ExpiredPath[]).map(item => item.path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await client.storage.from("story-media").remove(paths);
      if (storageError) throw storageError;
      const { error: queueError } = await client.from("beatbox_expired_story_media").delete().in("path", paths);
      if (queueError) throw queueError;
    }

    return res.json({ ok: true, expiredStories: paths.length, taskUid: user.taskUid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Story cleanup failure";
    console.error("[story-expiry-cleanup]", error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
