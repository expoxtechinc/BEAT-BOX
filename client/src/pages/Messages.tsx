import React, { useEffect, useMemo, useState } from "react";
import { Paperclip, Send, Search, Trash2, MessageCircle, LockKeyhole, Copy, Heart } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { formatUploadSize, uploadResumable } from "@/lib/resumableUpload";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ProfileRow = { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null };
type Conversation = { id: string; updated_at: string; conversation_members?: { user_id: string; profiles?: ProfileRow | ProfileRow[] | null; last_read_at?: string | null }[] };
type Message = { id: string; sender_id: string; body?: string | null; attachment_path?: string | null; attachment_type?: string | null; reply_to_id?: string | null; deleted_at?: string | null; created_at: string };

export default function Messages() {
  usePageMeta("Messages", "Private BeatBox conversations with secure attachments.");
  const { user } = useSupabaseAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const quickReplyMutation = trpc.ai.chat.useMutation();
  const requestedRecipient = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("to");

  const loadConversations = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("conversations").select("id, updated_at, conversation_members(user_id, last_read_at, profiles(id, username, display_name, avatar_url))").order("updated_at", { ascending: false });
    if (error) { setNotice(error.message); return; }
    const own = (data ?? []).filter((row: Conversation) => row.conversation_members?.some(member => member.user_id === user.id));
    setConversations(own);
  };

  useEffect(() => { void loadConversations(); }, [user]);
  useEffect(() => {
    if (!activeId || !user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const load = async () => {
      const { data } = await supabase.from("messages").select("id, sender_id, body, attachment_path, attachment_type, reply_to_id, deleted_at, created_at").eq("conversation_id", activeId).order("created_at", { ascending: true });
      setMessages((data as Message[] | null) ?? []);
      await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", activeId).eq("user_id", user.id);
      channel = supabase.channel(`messages:${activeId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, payload => setMessages(current => current.some(item => item.id === payload.new.id) ? current : [...current, payload.new as Message])).subscribe();
    };
    void load();
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, [activeId, user]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const message of messages) {
        if (!message.attachment_path) continue;
        const result = await supabase.storage.from("message-media").createSignedUrl(message.attachment_path, 300);
        if (!result.error && result.data?.signedUrl) next[message.id] = result.data.signedUrl;
      }
      if (!cancelled) setAttachmentUrls(next);
    })();
    return () => { cancelled = true; };
  }, [messages]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!user || query.trim().length < 2) { setProfiles([]); return; }
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`).neq("id", user.id).limit(8);
      setProfiles((data as ProfileRow[] | null) ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, user]);

  const activeConversation = useMemo(() => conversations.find(item => item.id === activeId), [activeId, conversations]);
  const profileFromRelation = (value: ProfileRow | ProfileRow[] | null | undefined) => Array.isArray(value) ? value[0] : value;
  const activeOther = profileFromRelation(activeConversation?.conversation_members?.find(member => member.user_id !== user?.id)?.profiles);

  const startConversation = async (profile: ProfileRow) => {
    if (!user || profile.id === user.id) return;
    setBusy(true); setNotice(null);
    const existing = conversations.find(conversation => {
      const ids = conversation.conversation_members?.map(member => member.user_id) || [];
      return ids.includes(user.id) && ids.includes(profile.id) && ids.length === 2;
    });
    if (existing) {
      setQuery(""); setProfiles([]); setActiveId(existing.id); setBusy(false); return;
    }
    const { data: conversation, error } = await supabase.from("conversations").insert({}).select("id, updated_at").single();
    if (error || !conversation) { setNotice(error?.message || "Unable to start a private conversation. Try again while online."); setBusy(false); return; }
    const { error: memberError } = await supabase.from("conversation_members").insert([{ conversation_id: conversation.id, user_id: user.id }, { conversation_id: conversation.id, user_id: profile.id }]);
    if (memberError) {
      await supabase.from("conversations").delete().eq("id", conversation.id);
      setNotice(memberError.message.includes("recursion") ? "Private messaging is temporarily unavailable while access rules refresh. Please retry." : "This profile cannot receive a private conversation right now.");
      setBusy(false); return;
    }
    setQuery(""); setProfiles([]); await loadConversations(); setActiveId(conversation.id); setBusy(false);
  };

  useEffect(() => {
    if (!user || !requestedRecipient || activeId || requestedRecipient === user.id) return;
    void supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", requestedRecipient).maybeSingle().then(({ data }) => {
      if (data) void startConversation(data as ProfileRow);
      else setNotice("That BeatBox member could not be found. Search by username or display name and try again.");
    });
  }, [user?.id, requestedRecipient, activeId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !activeId || (!body.trim() && !file)) return;
    if (file && file.size > 50 * 1024 * 1024) {
      setNotice("Attachments must be 50 MB or smaller. Large uploads require a stable online connection.");
      return;
    }
    if (!navigator.onLine) {
      setNotice("You are offline. BeatBox keeps messages readable, but sending attachments requires an internet connection.");
      return;
    }
    setBusy(true); setUploadProgress(0); setNotice(null);
    let attachmentPath: string | null = null;
    if (file) {
      const path = `${user.id}/${activeId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await uploadResumable({ bucket: "message-media", objectPath: path, file, onProgress: (percent, uploaded, total) => { setUploadProgress(percent); setNotice(`Uploading attachment ${percent}% · ${formatUploadSize(uploaded)} of ${formatUploadSize(total)}. You can retry if interrupted.`); } });
      attachmentPath = path;
    }
    const { data, error } = await supabase.from("messages").insert({ conversation_id: activeId, sender_id: user.id, body: body.trim() || null, attachment_path: attachmentPath, attachment_type: file?.type || null, reply_to_id: replyTo?.id || null }).select("id, sender_id, body, attachment_path, attachment_type, reply_to_id, deleted_at, created_at").single();
    if (error) setNotice(error.message); else if (data) { setMessages(current => [...current, data as Message]); setBody(""); setFile(null); setReplyTo(null); }
    setBusy(false);
  };

  const reactToMessage = async (message: Message) => {
    if (!user) return;
    const { error } = await supabase.from("message_reactions").upsert({ message_id: message.id, user_id: user.id, reaction: "like" }, { onConflict: "message_id,user_id" });
    if (error) setNotice(error.message); else setNotice("Reaction saved.");
  };

  const copyMessage = async (message: Message) => {
    if (!message.body) { setNotice("There is no text to copy from this message."); return; }
    try { await navigator.clipboard.writeText(message.body); setNotice("Message copied."); }
    catch { setNotice("Copy is unavailable in this browser context."); }
  };

  const generateQuickReplies = () => {
    if (!user || !activeOther || quickReplyMutation.isPending) return;
    if (!navigator.onLine) { toast.info("Reconnect to generate AI quick replies."); return; }
    const recent = messages.filter(message => message.body && !message.deleted_at).slice(-6).map(message => `${message.sender_id === user.id ? "Me" : activeOther.display_name || activeOther.username || "Creator"}: ${message.body}`).join("\n");
    quickReplyMutation.mutate({
      messages: [{ role: "user", content: `Suggest exactly three short, natural replies I can send to this BeatBox creator. Return one suggestion per line, without numbering, quotes, or explanation. Keep each under 90 characters. Recent conversation:\n${recent || "No messages yet."}` }],
      context: "Messaging quick replies. Keep the suggestions respectful, concise, and never claim a payment or transaction succeeded.",
    }, {
      onSuccess: result => {
        const suggestions = result.text.split(/\n+/).map(item => item.replace(/^[-*•\d.)\s]+/, "").trim()).filter(item => item.length > 0 && item.length <= 120).slice(0, 3);
        setQuickReplies(suggestions);
        if (!suggestions.length) toast.info("The assistant did not return quick replies. Try again.");
      },
      onError: error => toast.error(error.message || "Quick replies are unavailable right now."),
    });
  };

  const reportOrBlockNotice = (action: "report" | "block") => {
    setNotice(action === "report" ? "To report a private message, use BeatBox Help and include the conversation details." : "Blocking is managed from the member profile; no local block state was created.");
  };

  const deleteMessage = async (message: Message) => {
    if (!user || message.sender_id !== user.id) return;
    const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: null }).eq("id", message.id).eq("sender_id", user.id);
    if (!error) setMessages(current => current.map(item => item.id === message.id ? { ...item, deleted_at: new Date().toISOString(), body: null } : item));
  };

  if (!user) return <section className="status-page"><LockKeyhole size={30} /><h1>Sign in to message</h1><p>Private BeatBox conversations are available to authenticated members.</p></section>;

  return <section className="messages-page"><div className="container"><div className="page-intro"><p className="eyebrow"><span /> Private conversations</p><h1>Messages</h1><p>Send text, images, documents, music, video, or other files. Attachments remain private and uploads require an internet connection.</p></div><div className="messages-layout"><aside className="messages-sidebar"><div className="search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people…" aria-label="Search people" /></div>{profiles.length > 0 && <div className="message-user-results">{profiles.map(profile => <button type="button" key={profile.id} onClick={() => void startConversation(profile)} disabled={busy}><strong>{profile.display_name || profile.username || "BeatBox member"}</strong><small>@{profile.username || profile.id.slice(0, 8)}</small></button>)}</div>}{conversations.length === 0 ? <div className="empty-featured empty-featured--light"><MessageCircle size={28} /><h2>No conversations yet</h2><p>Search for a BeatBox member to start one.</p></div> : conversations.map(conversation => { const other = profileFromRelation(conversation.conversation_members?.find(member => member.user_id !== user.id)?.profiles); return <button type="button" key={conversation.id} className={`conversation-item ${conversation.id === activeId ? "is-active" : ""}`} onClick={() => setActiveId(conversation.id)}><strong>{other?.display_name || other?.username || "BeatBox member"}</strong><small>@{other?.username || "member"}</small></button>; })}</aside><section className="conversation-panel">{activeId ? <><header className="conversation-header"><MessageCircle size={18} /><div><strong>{activeOther?.display_name || activeOther?.username || "Conversation"}</strong><small>{activeOther?.username ? `@${activeOther.username}` : "Private BeatBox chat"}</small></div></header><div className="message-list" aria-live="polite">{messages.map(message => <article key={message.id} className={`message-bubble ${message.sender_id === user.id ? "is-own" : ""}`}>{message.deleted_at ? <em>Message deleted</em> : <>{message.reply_to_id && <small>Replying to a message</small>}{message.body && <p>{message.body}</p>}{message.attachment_path && (attachmentUrls[message.id] ? <a href={attachmentUrls[message.id]} target="_blank" rel="noreferrer">Open secure attachment</a> : <small>Preparing secure attachment…</small>)}<time>{new Date(message.created_at).toLocaleString()}</time>{message.sender_id === user.id && <button type="button" className="icon-action" onClick={() => void deleteMessage(message)} aria-label="Delete message"><Trash2 size={14} /></button>}<button type="button" className="text-button" onClick={() => void reactToMessage(message)}><Heart size={13} /> React</button><button type="button" className="text-button" onClick={() => void copyMessage(message)}><Copy size={13} /> Copy</button>{message.sender_id !== user.id && <><button type="button" className="text-button" onClick={() => setReplyTo(message)}>Reply</button><button type="button" className="text-button" onClick={() => reportOrBlockNotice("report")}>Report</button><button type="button" className="text-button" onClick={() => reportOrBlockNotice("block")}>Block</button></>}</>}</article>)}</div><form className="message-compose" onSubmit={send}>{activeOther && <div className="quick-replies" aria-live="polite"><div className="quick-replies__header"><span>Quick replies</span><button type="button" className="text-button" onClick={generateQuickReplies} disabled={quickReplyMutation.isPending}>{quickReplyMutation.isPending ? "Thinking…" : quickReplies.length ? "Refresh" : "Suggest with AI"}</button></div>{quickReplies.map(reply => <button type="button" className="quick-reply-chip" key={reply} onClick={() => { setBody(reply); setQuickReplies([]); }}>{reply}</button>)}</div>}{replyTo && <button type="button" className="reply-context" onClick={() => setReplyTo(null)}>Replying to a message · cancel</button>}<textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Write a private message…" rows={2} /><label className="attachment-button"><Paperclip size={16} />{file ? file.name : "Attach"}<input type="file" accept="*/*" onChange={event => setFile(event.target.files?.[0] || null)} /></label>{busy && file && <div className="upload-progress" aria-live="polite"><div className="upload-progress__label"><span>Attachment upload</span><b>{uploadProgress}%</b></div><progress max="100" value={uploadProgress}>{uploadProgress}%</progress></div>}<button className="button" type="submit" disabled={busy || (!body.trim() && !file)}><Send size={16} /> Send</button></form></> : <div className="empty-featured empty-featured--light"><MessageCircle size={34} /><h2>Choose a conversation</h2><p>Search for a member or select a conversation to begin.</p></div>}</section></div>{notice && <p className="form-error" role="alert">{notice}</p>}</div></section>;
}
