import type { Request, Response } from "express";
import { createApp } from "./_core/app";

// This source is bundled into api/index.js by the production build so Vercel
// receives all internal server modules in one traceable function artifact.
const app = createApp();

function restoreApiPath(req: Request) {
  const originalPath = req.query.__beatbox_path;
  if (typeof originalPath !== "string") return;

  const queryIndex = req.url.indexOf("?");
  const remainingQuery = queryIndex >= 0 ? req.url.slice(queryIndex + 1) : "";
  const search = new URLSearchParams(remainingQuery);
  search.delete("__beatbox_path");
  const query = search.toString();
  req.url = `/api/${originalPath}${query ? `?${query}` : ""}`;
}

export default function handler(req: Request, res: Response) {
  restoreApiPath(req);
  return app(req, res);
}
