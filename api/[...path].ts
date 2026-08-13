// Vercel file-system catch-all for every nested `/api/*` request.
// Keep the implementation in index.ts so `/api` and nested API URLs share
// the same credential-safe health shortcut and lazy Express application load.
export { default } from "./index";
