import type { Express, Request, Response } from "express";

type ServiceCheck = {
  configured: boolean;
  reachable: boolean | null;
};

let appPromise: Promise<Express> | undefined;

function timeoutSignal(timeoutMs = 6_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function checkGemini(): Promise<ServiceCheck> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { configured: false, reachable: null };

  const timeout = timeoutSignal();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      signal: timeout.signal,
    });
    return { configured: true, reachable: response.ok };
  } catch {
    return { configured: true, reachable: false };
  } finally {
    timeout.clear();
  }
}

async function checkSupabase(): Promise<ServiceCheck> {
  const url = process.env.VITE_SUPABASE_URL;
  const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) return { configured: false, reachable: null };

  const timeout = timeoutSignal();
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/beats?select=id&limit=1`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: timeout.signal,
    });
    return { configured: true, reachable: response.ok };
  } catch {
    return { configured: true, reachable: false };
  } finally {
    timeout.clear();
  }
}

async function loadApp() {
  appPromise ??= import("../server/_core/app").then(({ createApp }) => createApp());
  return appPromise;
}

function restoreApiPath(req: Request) {
  const url = new URL(req.url || "/", "https://beatbox.local");
  const apiPath = url.searchParams.get("__beatbox_path");
  if (!apiPath) return url.pathname;

  url.searchParams.delete("__beatbox_path");
  const path = `/api/${apiPath.replace(/^\/+/, "")}`;
  const query = url.searchParams.toString();
  req.url = `${path}${query ? `?${query}` : ""}`;
  return path;
}

/**
 * Vercel invokes this handler for every /api request. `/api/health` deliberately
 * avoids importing the full application, enabling credential-safe production
 * diagnosis even when another application module fails during serverless boot.
 */
export default async function handler(req: Request, res: Response) {
  const path = restoreApiPath(req);
  if (path === "/api/health") {
    const [gemini, database] = await Promise.all([checkGemini(), checkSupabase()]);
    const ok = gemini.reachable !== false && database.reachable !== false;
    res.setHeader("Cache-Control", "no-store");
    res.status(ok ? 200 : 503).json({
      ok,
      services: { gemini, database },
      checkedAt: new Date().toISOString(),
    });
    return;
  }

  const app = await loadApp();
  app(req, res);
}
