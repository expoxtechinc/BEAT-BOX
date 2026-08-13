import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const query = await readFile(resolve(root, "supabase/migrations/20260813_beatbox_truthful_engagement_analytics.sql"), "utf8");

await writeFile(
  "/home/ubuntu/engagement_analytics_migration.json",
  JSON.stringify({
    project_id: "huhsbpjdwepovtjraxsd",
    name: "beatbox_truthful_engagement_analytics",
    query,
  }),
);
