import { readFile, writeFile } from "node:fs/promises";

const query = await readFile(new URL("../supabase/migrations/20260813_beatbox_stories_24h_audio.sql", import.meta.url), "utf8");
await writeFile(
  new URL("../../story_lifecycle_migration.json", import.meta.url),
  JSON.stringify({
    project_id: "huhsbpjdwepovtjraxsd",
    name: "beatbox_stories_24h_audio",
    query,
  }),
);
