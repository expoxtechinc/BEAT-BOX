import type { Express, Request, Response } from "express";

import type { Request, Response } from "express";
import { createApp } from "../server/_core/app";

// A static import lets Vercel trace and bundle the shared server modules.
const app = createApp();

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
 * Vercel invokes this handler for non-filesystem API requests. `/api/health` is
 * a separate function so it can diagnose service reachability without this app.
 */
export default function handler(req: Request, res: Response) {
  restoreApiPath(req);
  return app(req, res);
}
