import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { MessageCircle, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const normalizeWhatsApp = (value: string) => value.trim().replace(/[^0-9+]/g, "");

export function WhatsAppContactSettings() {
  const { user, profile, refreshProfile } = useSupabaseAuth();
  const [number, setNumber] = useState(profile?.whatsapp_number || "");
  const [isPublic, setIsPublic] = useState(Boolean(profile?.whatsapp_public));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNumber(profile?.whatsapp_number || "");
    setIsPublic(Boolean(profile?.whatsapp_public));
  }, [profile?.whatsapp_number, profile?.whatsapp_public]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("update_self_whatsapp_contact", {
      p_whatsapp_number: normalizeWhatsApp(number) || null,
      p_public: isPublic,
    });
    if (error) {
      setMessage(error.message);
    } else {
      await refreshProfile();
      setMessage(number.trim() && isPublic
        ? "WhatsApp contact saved and shown only on your public seller profile and paid listing purchase panel."
        : "WhatsApp contact saved privately. Turn on public contact only when you want buyers to start a WhatsApp chat.");
    }
    setBusy(false);
  };

  return <section className="dashboard-page dashboard-page--compact"><div className="container"><form className="dashboard-panel profile-form" onSubmit={save}><h2><MessageCircle /> WhatsApp contact</h2><p>Use your full number with country code. This remains private unless you explicitly enable public buyer contact. Clearing the number removes the public chat link.</p><div className="field-grid"><label>WhatsApp number<input value={number} inputMode="tel" autoComplete="tel" onChange={event => setNumber(event.target.value)} placeholder="+231…" maxLength={16} /></label><label className="checkbox-field field-grid__wide"><input type="checkbox" checked={isPublic} disabled={!number.trim()} onChange={event => setIsPublic(event.target.checked)} />Show a WhatsApp chat button on my public seller profile and paid beat purchase panel</label></div><button className="button button--small" disabled={busy}>{busy ? "Saving…" : <><Save size={14} /> Save contact</>}</button>{message && <p className={message.startsWith("WhatsApp contact saved") ? "form-success" : "form-error"}>{message.startsWith("WhatsApp contact saved") && <ShieldCheck size={16} />}{message}</p>}</form></div></section>;
}
