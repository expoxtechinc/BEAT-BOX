import { useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Music2, Sparkles, UsersRound } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { Profile } from "@/lib/models";
import { supabase } from "@/lib/supabase";

type CreatorRole = NonNullable<Profile["primary_creator_role"]>;

type Props = {
  profile: Pick<Profile, "creator_roles" | "primary_creator_role" | "creator_genres" | "creator_onboarding_completed"> | null;
  onComplete?: () => void;
  compact?: boolean;
};

const roles: Array<{ id: CreatorRole; title: string; description: string; icon: typeof Music2 }> = [
  { id: "listener", title: "Listener", description: "Discover releases, save favorites, and support creators.", icon: UsersRound },
  { id: "artist", title: "Artist", description: "Publish music, build your audience, and share releases.", icon: Music2 },
  { id: "producer", title: "Producer", description: "Share beats, production assets, and licensed sounds.", icon: Sparkles },
  { id: "creator", title: "Creator", description: "Publish community media, podcasts, and creative projects.", icon: Sparkles },
];

const genreOptions = ["Afrobeats", "Hip-Hop", "Gospel", "R&B", "Dancehall", "Amapiano", "Pop", "Electronic"];

export function CreatorRoleOnboarding({ profile, onComplete, compact = false }: Props) {
  const { refreshProfile } = useSupabaseAuth();
  const initialPrimary = profile?.primary_creator_role || "listener";
  const [primaryRole, setPrimaryRole] = useState<CreatorRole>(initialPrimary);
  const [selectedRoles, setSelectedRoles] = useState<CreatorRole[]>(() => {
    const existing = profile?.creator_roles?.filter(role => roles.some(candidate => candidate.id === role)) || [];
    return existing.length ? existing : [initialPrimary];
  });
  const [genres, setGenres] = useState<string[]>(profile?.creator_genres || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const primary = useMemo(() => roles.find(role => role.id === primaryRole) || roles[0], [primaryRole]);
  const toggleRole = (role: CreatorRole) => {
    setSelectedRoles(current => current.includes(role) ? (current.length > 1 ? current.filter(item => item !== role) : current) : [...current, role]);
  };
  const toggleGenre = (genre: string) => setGenres(current => current.includes(genre) ? current.filter(item => item !== genre) : [...current, genre]);

  const save = async () => {
    setSaving(true); setError(null); setMessage(null);
    const { error: saveError } = await supabase.rpc("set_creator_identity", {
      p_primary_role: primaryRole,
      p_roles: selectedRoles.includes(primaryRole) ? selectedRoles : [...selectedRoles, primaryRole],
      p_genres: genres,
    });
    if (saveError) {
      setError(saveError.message);
    } else {
      await refreshProfile();
      setMessage("Your BeatBox creator identity is ready.");
      onComplete?.();
    }
    setSaving(false);
  };

  return <section className={`creator-onboarding ${compact ? "creator-onboarding--compact" : ""}`} aria-labelledby="creator-onboarding-title">
    <div className="creator-onboarding__intro"><div className="creator-onboarding__icon"><Sparkles size={20} /></div><div><p className="eyebrow"><span /> Creator identity</p><h2 id="creator-onboarding-title">Shape your BeatBox presence</h2><p>Choose how you want to show up. You can listen as anyone, while artist, producer, and creator identities unlock role-specific publishing guidance.</p></div></div>
    <div className="creator-role-grid">{roles.map(({ id, title, description, icon: Icon }) => { const active = primaryRole === id; const included = selectedRoles.includes(id); return <button className={`creator-role-card ${active ? "is-primary" : ""} ${included ? "is-included" : ""}`} type="button" key={id} onClick={() => { setPrimaryRole(id); if (!included) toggleRole(id); }} aria-pressed={active}><span className="creator-role-card__check">{included ? <Check size={14} /> : <Icon size={18} />}</span><span><b>{title}</b><small>{description}</small></span>{active && <ChevronRight size={16} aria-hidden="true" />}</button>; })}</div>
    <div className="creator-onboarding__subsection"><div><b>Additional identities</b><p>Select every role you want to use on BeatBox.</p></div><div className="creator-chip-list">{roles.filter(role => role.id !== primaryRole).map(role => <button className={`creator-chip ${selectedRoles.includes(role.id) ? "is-selected" : ""}`} key={role.id} type="button" onClick={() => toggleRole(role.id)}>{selectedRoles.includes(role.id) && <Check size={13} />}{role.title}</button>)}</div></div>
    <div className="creator-onboarding__subsection"><div><b>What do you make?</b><p>Choose up to twelve genres to improve creator discovery.</p></div><div className="creator-chip-list">{genreOptions.map(genre => <button className={`creator-chip ${genres.includes(genre) ? "is-selected" : ""}`} key={genre} type="button" onClick={() => { if (!genres.includes(genre) && genres.length >= 12) return; toggleGenre(genre); }}>{genres.includes(genre) && <Check size={13} />}{genre}</button>)}</div></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <div className="creator-onboarding__footer"><p><strong>{primary.title}</strong> is your primary public identity.</p><button className="button" type="button" onClick={() => void save()} disabled={saving}>{saving ? <><Loader2 size={15} className="spin" /> Saving identity…</> : "Save creator identity"}</button></div>
  </section>;
}
