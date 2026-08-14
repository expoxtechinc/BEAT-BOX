import { createRoot } from "react-dom/client";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import App from "./App";
import { SupabaseAuthProvider } from "./contexts/SupabaseAuthContext";
import { trpc } from "./lib/trpc";
import { supabase } from "./lib/supabase";
import "./index.css";

const queryClient = new QueryClient();

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;
if (analyticsEndpoint && analyticsWebsiteId && typeof document !== "undefined") {
  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = `${analyticsEndpoint.replace(/\/$/, "")}/umami`;
  analyticsScript.dataset.websiteId = analyticsWebsiteId;
  document.head.appendChild(analyticsScript);
}
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${window.location.origin}/api/trpc`,
      fetch: async (url, options) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = new Headers(options?.headers);
        if (token) headers.set("authorization", `Bearer ${token}`);
        const response = await fetch(url, { ...options, headers, credentials: "include" });
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) return response;
        const responseText = await response.text();
        const message = response.status === 401
          ? "Please sign in again to use BeatBox AI."
          : response.status >= 500
            ? "BeatBox AI is temporarily unavailable. Please try again shortly."
            : responseText.includes("<!doctype html") || responseText.includes("<html")
              ? "BeatBox AI endpoint is unavailable in this deployment."
              : "BeatBox AI returned an invalid response.";
        return new Response(JSON.stringify({ error: { json: { message } } }), {
          status: response.ok ? 502 : (response.status || 502),
          headers: { "content-type": "application/json" },
        });
      },
    }),
  ],
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let reloadingForServiceWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(async registration => {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        await registration.update();
      })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider><App /></SupabaseAuthProvider>
    </QueryClientProvider>
  </trpc.Provider>,
);
