import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(12),
  context: z.string().max(6000).optional(),
});

type ProviderName = "gemini" | "groq" | "openrouter" | "manus";
export type ProviderResult = { text: string; provider: ProviderName; model: string };
export type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderCall = (messages: OpenAIMessage[]) => Promise<ProviderResult>;
export type ProviderDescriptor = { name: ProviderName; call: ProviderCall };

const timeoutMs = () => {
  const parsed = Number(process.env.AI_ROUTER_TIMEOUT_MS ?? ENV.aiRouterTimeoutMs);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 3_000), 30_000) : 18_000;
};

const enabled = () => (process.env.AI_ROUTER_ENABLED ?? ENV.aiRouterEnabled) !== "false";

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI provider timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const fetchJson = async (url: string, init: RequestInit) => {
  const response = await withTimeout(fetch(url, init), timeoutMs());
  const body = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
  } catch {
    // Keep provider errors safe and concise; never echo credentials or raw bodies.
  }
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return payload;
};

const textFromOpenAIResponse = (payload: Record<string, unknown>) => {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  return typeof first?.message?.content === "string" ? first.message.content.trim() : "";
};

const systemPrompt = (context?: string) =>
  [
    "You are BeatBox Assistant, a concise and trustworthy guide for Liberia's beat marketplace.",
    "Help users discover beats, understand licenses, publish creator content, use community features, manage products, and understand payment-request workflows.",
    "Never claim that a payment succeeded unless the marketplace explicitly reports a verified payment. Never invent reviews, ratings, earnings, customers, listings, or API results.",
    "If asked to perform an action you cannot perform, explain the safe next step.",
    context ? `Current BeatBox context:\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const providerMessages = (messages: z.infer<typeof chatMessageSchema>[], context?: string): OpenAIMessage[] => [
  { role: "system", content: systemPrompt(context) },
  ...messages.map(message => ({ role: message.role, content: message.content })),
];

async function callGemini(messages: OpenAIMessage[]): Promise<ProviderResult> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  if (!key) throw new Error("Gemini not configured");
  const contents = messages.filter(message => message.role !== "system").map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: messages[0]?.content ?? "" }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
    }),
  });
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const parts = (candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined)?.content?.parts ?? [];
  const text = parts.map(part => part.text ?? "").join(" ").trim();
  if (!text) throw new Error("Gemini returned no text");
  return { text, provider: "gemini", model };
}

async function callOpenAICompatible(provider: Exclude<ProviderName, "gemini" | "manus">, messages: OpenAIMessage[]): Promise<ProviderResult> {
  const config = provider === "groq"
    ? { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1/chat/completions" }
    : { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3-0324:free", url: "https://openrouter.ai/api/v1/chat/completions" };
  if (!config.key) throw new Error(`${provider} not configured`);
  const payload = await fetchJson(config.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.key}`,
      ...(provider === "openrouter" ? { "HTTP-Referer": "https://beatbox.market", "X-Title": "BeatBox" } : {}),
    },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.4, max_tokens: 900 }),
  });
  const text = textFromOpenAIResponse(payload);
  if (!text) throw new Error(`${provider} returned no text`);
  return { text, provider, model: config.model };
}

async function callManus(messages: OpenAIMessage[]): Promise<ProviderResult> {
  const payload = await invokeLLM({ model: undefined, messages, maxTokens: 900 });
  const content = payload.choices[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new Error("Built-in provider returned no text");
  return { text, provider: "manus", model: payload.model || "built-in" };
}

export const providers: ProviderDescriptor[] = [
  { name: "gemini", call: callGemini },
  { name: "groq", call: messages => callOpenAICompatible("groq", messages) },
  { name: "openrouter", call: messages => callOpenAICompatible("openrouter", messages) },
  { name: "manus", call: callManus },
];

const isProviderConfigured = (name: ProviderName) => name === "gemini"
  ? Boolean(process.env.GEMINI_API_KEY)
  : name === "groq"
    ? Boolean(process.env.GROQ_API_KEY)
    : name === "openrouter"
      ? Boolean(process.env.OPENROUTER_API_KEY)
      : Boolean(ENV.forgeApiKey);

const configuredProviders = () => providers.filter(provider => isProviderConfigured(provider.name));
const maxAttemptsPerProvider = 2;

export async function routeWithFallback(
  messages: OpenAIMessage[],
  providerList: ProviderDescriptor[] = providers,
  attempts = maxAttemptsPerProvider,
  providerTimeoutMs = timeoutMs(),
) {
  const failures: string[] = [];
  for (const provider of providerList) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await withTimeout(provider.call(messages), providerTimeoutMs);
        return { result, failures };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "failed";
        failures.push(`${provider.name}#${attempt}:${reason}`);
        if (attempt < attempts) await Promise.resolve();
      }
    }
  }
  throw new Error("No BeatBox AI provider is available right now.");
}

export const aiRouter = router({
  chat: protectedProcedure.input(chatInputSchema).mutation(async ({ input }) => {
    if (!enabled()) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BeatBox AI is temporarily disabled." });
    const messages = providerMessages(input.messages, input.context);
    try {
      const availableProviders = configuredProviders();
      if (!availableProviders.length) throw new Error("No BeatBox AI provider is configured.");
      const { result } = await routeWithFallback(messages, availableProviders);
      return { ...result, fallbackUsed: result.provider !== availableProviders[0].name };
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No BeatBox AI provider is available right now." });
    }
  }),
  health: publicProcedure.query(() => ({
    enabled: enabled(),
    timeoutMs: timeoutMs(),
    maxAttemptsPerProvider,
    order: providers.map(provider => provider.name),
    providers: providers.map(provider => ({ name: provider.name, configured: isProviderConfigured(provider.name) })),
    note: "Provider availability can change because of quotas, outages, or rate limits; requests retry and fail over without exposing keys.",
  })),
});
