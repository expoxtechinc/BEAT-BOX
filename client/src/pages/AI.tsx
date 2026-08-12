import { Link } from "wouter";
import { Sparkles, ShieldCheck, WifiOff } from "lucide-react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

const cachedHelp: Array<{ match: RegExp; answer: string }> = [
  { match: /publish|upload|beat/i, answer: "To publish a beat, open your seller dashboard, add the title, cover image, audio preview, and price, then keep any paid master in private storage. Free beats can be downloaded when the listing marks them free; paid masters require a verified order." },
  { match: /license/i, answer: "Check each listing’s license terms before downloading. If a license is unclear, contact the creator through their profile message button and keep payment requests inside the documented BeatBox workflow." },
  { match: /payment|mobile money|orange|whatsapp/i, answer: "BeatBox can display a payment-request workflow for supported local methods, but an order is not successful until the marketplace records verified confirmation. Do not treat a chat receipt or screenshot alone as a completed order." },
  { match: /profile|creator/i, answer: "Complete your profile with a display name and avatar, then use the creator tools to publish public Reels or marketplace content. Public social media should never contain paid masters or private account documents." },
];

function getCachedHelp(content: string) {
  const match = cachedHelp.find(item => item.match.test(content));
  return match?.answer ?? "You are offline, so BeatBox AI cannot contact the server right now. You can still browse cached pages and saved marketplace data. Reconnect to ask a new AI question, or ask about publishing, licenses, payments, profiles, or creator tools.";
}

export default function AI() {
  const { user, profile, loading } = useSupabaseAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const chat = trpc.ai.chat.useMutation();
  const health = trpc.ai.health.useQuery(undefined, { staleTime: 30_000, enabled: !isOffline });

  useEffect(() => {
    const online = () => setIsOffline(false);
    const offline = () => setIsOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  if (loading) return <section className="status-page"><div className="loading-dots" aria-label="Loading BeatBox AI" /><p>Preparing your assistant…</p></section>;
  if (!user) return <section className="container py-16"><div className="mx-auto max-w-2xl rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm"><Sparkles className="mx-auto mb-4 size-10 text-primary" /><h1 className="font-display text-3xl font-bold">BeatBox AI Assistant</h1><p className="mt-3 text-muted-foreground">Sign in to ask about beats, licensing, publishing, products, community tools, or payment requests.</p><Button asChild className="mt-6"><Link href="/auth">Sign in to continue</Link></Button></div></section>;

  const sendMessage = (content: string) => {
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    if (isOffline) {
      setMessages(current => [...current, { role: "assistant", content: getCachedHelp(content) }]);
      return;
    }
    chat.mutate({ messages: nextMessages.filter((message): message is Extract<Message, { role: "user" | "assistant" }> => message.role !== "system").slice(-10), context: `Signed-in BeatBox user. Role: ${profile?.role ?? "buyer"}. Display name: ${profile?.display_name ?? "not provided"}. Do not reveal private account data.` }, {
      onSuccess: result => {
        setMessages(current => [...current, { role: "assistant", content: result.text }]);
        try { localStorage.setItem("beatbox-ai-last-answer", JSON.stringify({ content, answer: result.text, savedAt: Date.now() })); } catch { /* storage may be unavailable in private browsing */ }
      },
      onError: error => setMessages(current => [...current, { role: "assistant", content: `The server-side AI providers could not answer this request. ${error.message} You can retry when connectivity or provider quota returns.` }]),
    });
  };

  const configuredCount = health.data?.providers.filter(provider => provider.configured).length ?? 0;
  return <section className="container py-8 md:py-12"><div className="mx-auto max-w-5xl"><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="size-3.5" /> BeatBox AI</div><h1 className="font-display text-4xl font-bold tracking-tight">Your marketplace co-pilot</h1><p className="mt-2 max-w-2xl text-muted-foreground">Get practical help with discovery, licenses, creator publishing, products, community, and honest payment-request guidance.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-500" /> Server-side keys only</div></div><div className="mb-4 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground" role="status">{isOffline ? <><WifiOff className="mr-2 inline size-4 text-amber-500" /><strong className="text-foreground">Lite/offline mode:</strong> no AI request is sent. BeatBox is using safe built-in help and will resume server AI when you reconnect.</> : <><strong className="text-foreground">AI status:</strong> {health.isLoading ? "checking server-side providers…" : health.data?.enabled && configuredCount ? `${configuredCount} provider(s) configured; fallback order: ${health.data.order.join(" → ")}.` : "No server-side AI provider is configured in this deployment. Add provider variables in Vercel and redeploy."}</>}</div><AIChatBox messages={messages} onSendMessage={sendMessage} isLoading={chat.isPending && !isOffline} height="min(680px, 72vh)" emptyStateMessage="Ask BeatBox AI anything about the marketplace." suggestedPrompts={["How do I publish a beat?", "Explain beat license options", "How do payment requests work?", "Help me set up my creator profile"]} />{chat.data && <p className="mt-3 text-center text-xs text-muted-foreground">Answered by {chat.data.provider}{chat.data.fallbackUsed ? " fallback" : ""}.</p>}</div></section>;
}
