import type { Request, Response } from "express";

type ServiceCheck = {
  configured: boolean;
  reachable: boolean | null;
};

type VercelResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(payload: unknown): void };
};

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

/**
 * Standalone Vercel diagnostic. It intentionally avoids the Express application
 * so deployment configuration and service reachability can be diagnosed safely.
 */
export default async function handler(_req: unknown, res: VercelResponseLike) {
  const [gemini, database] = await Promise.all([checkGemini(), checkSupabase()]);
  const ok = gemini.reachable !== false && database.reachable !== false;
  res.setHeader("Cache-Control", "no-store");
  res.status(ok ? 200 : 503).json({
    ok,
    services: { gemini, database },
    checkedAt: new Date().toISOString(),
  });
}
