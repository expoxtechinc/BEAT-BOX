import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketplaceShell } from "@/components/MarketplaceShell";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { isSupabaseConfigured, supabaseConfigurationMessage } from "./lib/supabase";

const Home = lazy(() => import("./pages/Home"));
const Explore = lazy(() => import("@/pages/Explore"));
const BeatDetail = lazy(() => import("@/pages/BeatDetail"));
const Producers = lazy(async () => ({ default: (await import("@/pages/Producer")).Producers }));
const Producer = lazy(() => import("@/pages/Producer"));
const Auth = lazy(() => import("@/pages/Auth"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Cart = lazy(() => import("@/pages/Cart"));
const Account = lazy(async () => ({ default: (await import("@/pages/Dashboards")).Account }));
const Favorites = lazy(async () => ({ default: (await import("@/pages/Dashboards")).Favorites }));
const SavedItems = lazy(() => import("@/pages/SavedItems"));
const Profile = lazy(() => import("@/pages/Profile"));
const Seller = lazy(async () => ({ default: (await import("@/pages/Dashboards")).Seller }));
const Admin = lazy(async () => ({ default: (await import("@/pages/Dashboards")).Admin }));
const Community = lazy(() => import("@/pages/Community"));
const Reels = lazy(() => import("./pages/Reels"));
const SearchPage = lazy(() => import("./pages/Search"));
const Messages = lazy(() => import("./pages/Messages"));
const MarketCatalog = lazy(() => import("@/pages/MarketCatalog"));
const CreatorHub = lazy(() => import("@/pages/CreatorHub"));
const AI = lazy(() => import("@/pages/AI"));
const Info = lazy(() => import("@/pages/Info"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Router() {
  return (
    <MarketplaceShell>
      <Suspense fallback={<section className="status-page"><div className="loading-dots" aria-label="Loading BeatBox" /><p>Loading BeatBox…</p></section>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/explore" component={Explore} />
        <Route path="/beats/:slug" component={BeatDetail} />
        <Route path="/producers" component={Producers} />
        <Route path="/producers/:id" component={Producer} />
        <Route path="/auth" component={Auth} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/cart" component={Cart} />
        <Route path="/account" component={Account} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/saved" component={SavedItems} />
        <Route path="/profile" component={Profile} />
        <Route path="/seller" component={Seller} />
        <Route path="/feed" component={Community} />
        <Route path="/community" component={Community} />
        <Route path="/reels" component={Reels} />
        <Route path="/search" component={SearchPage} />
        <Route path="/messages" component={Messages} />
        <Route path="/catalog" component={MarketCatalog} />
        <Route path="/discover" component={MarketCatalog} />
        <Route path="/categories" component={MarketCatalog} />
        <Route path="/trending" component={MarketCatalog} />
        <Route path="/new-releases" component={MarketCatalog} />
        <Route path="/free-downloads" component={MarketCatalog} />
        <Route path="/paid-content" component={MarketCatalog} />
        <Route path="/products" component={MarketCatalog} />
        <Route path="/studio" component={CreatorHub} />
        <Route path="/ai" component={AI} />
        <Route path="/admin" component={Admin} />
        <Route path="/help" component={Info} />
        <Route path="/terms" component={Info} />
        <Route path="/privacy" component={Info} />
        <Route path="/contact" component={Info} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </MarketplaceShell>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {!isSupabaseConfigured && (
            <div className="deployment-notice" role="status">
              <strong>BeatBox setup required.</strong> {supabaseConfigurationMessage}
            </div>
          )}
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
