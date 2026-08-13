import { supabase } from "@/lib/supabase";

export type EngagementSubject = "beat" | "content" | "post" | "reel";
export type EngagementKind = "view" | "play";

/** Records an authenticated, server-validated event. A false response means it was already counted today. */
export async function recordEngagement(subjectType: EngagementSubject, subjectId: string, eventType: EngagementKind) {
  const { data, error } = await supabase.rpc("record_engagement_event", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_event_type: eventType,
  });
  if (error) throw error;
  return Boolean(data);
}
