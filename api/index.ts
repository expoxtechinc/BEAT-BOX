import { createApp } from "../server/_core/app";

// Vercel invokes this Express application for all /api requests. Secrets remain server-side.
export default createApp();
