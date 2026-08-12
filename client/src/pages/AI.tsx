import { Link } from "wouter";
import { Sparkles, ShieldCheck } from "lucide-react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function AI() {
  const { user, profile, loading } = useSupabaseAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const chat = trpc.ai.chat.useMutation();
  const health = trpc.ai.health.useQuery(undefined, { staleTime: 30_000 });

  if (loading) {
    return <section className="status-page"><div className="loading-dots" aria-label="Loading BeatBox AI" /><p>Preparing your assistant…</p></section>;
  }

  if (!user) {
    return (
      <section className="container py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
          <Sparkles className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="font-display text-3xl font-bold">BeatBox AI Assistant</h1>
          <p className="mt-3 text-muted-foreground">Sign in to ask about beats, licensing, publishing, products, community tools, or payment requests.</p>
          <Button asChild className="mt-6"><Link href="/auth">Sign in to continue</Link></Button>
        </div>
      </section>
    );
  }

  const sendMessage = (content: string) => {
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    chat.mutate(
      {
        messages: nextMessages.filter((message): message is Extract<Message, { role: "user" | "assistant" }> => message.role !== "system").slice(-10),
        context: `Signed-in BeatBox user. Role: ${profile?.role ?? "buyer"}. Display name: ${profile?.display_name ?? "not provided"}. Do not reveal private account data.`,
      },
      {
        onSuccess: result => setMessages(current => [...current, { role: "assistant", content: result.text }]),
        onError: error => setMessages(current => [...current, { role: "assistant", content: `I’m temporarily unavailable. ${error.message}` }]),
      },
    );
  };

  return (
    <section className="container py-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="size-3.5" /> BeatBox AI</div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Your marketplace co-pilot</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Get practical help with discovery, licenses, creator publishing, products, community, and honest payment-request guidance.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-500" /> Server-side keys only</div>
        </div>
        <div className="mb-4 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground" role="status"><strong className="text-foreground">AI status:</strong> {health.isLoading ? "checking providers…" : health.data?.enabled ? `${health.data.providers.filter(provider => provider.configured).length} provider(s) configured; fallback order: ${health.data.order.join(" → ")}.` : "AI is disabled in this deployment. Add server-side provider variables in Vercel and redeploy."}</div>
        <AIChatBox
          messages={messages}
          onSendMessage={sendMessage}
          isLoading={chat.isPending}
          height="min(680px, 72vh)"
          emptyStateMessage="Ask BeatBox AI anything about the marketplace."
          suggestedPrompts={["How do I publish a beat?", "Explain beat license options", "How do payment requests work?", "Help me set up my creator profile"]}
        />
        {chat.data && <p className="mt-3 text-center text-xs text-muted-foreground">Answered by {chat.data.provider}{chat.data.fallbackUsed ? " fallback" : ""}.</p>}
      </div>
    </section>
  );
}
