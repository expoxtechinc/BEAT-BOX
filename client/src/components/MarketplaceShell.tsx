import { BrandLogo } from "@/components/BrandLogo";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { BarChart3, Bell, Bookmark, Camera, CirclePause, CirclePlay, Compass, Heart, Library, Menu, MessageCircle, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLiteMode } from "@/hooks/useLiteMode";
import { Link, useLocation } from "wouter";

export function MarketplaceShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const { profile, user, signOut } = useSupabaseAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activePlayback, setActivePlayback] = useState<{ id: string; title: string; playing: boolean } | null>(null);
  useEffect(() => { if (!user) { setUnreadNotifications(0); return; } let active = true; void supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false).then(({ count }) => { if (active) setUnreadNotifications(count || 0); }); return () => { active = false; }; }, [user?.id]);
  const { liteMode, online, toggleLiteMode } = useLiteMode();
  const isCreator = Boolean(profile?.professional_mode || profile?.role === "seller" || profile?.role === "admin");
  const dashboardHref = profile?.role === "admin" ? "/admin" : isCreator ? "/studio" : "/account";
  const nav = [
    ["Discover", "/explore"],
    ["Search", "/search"],
    ["Catalog", "/catalog"],
    ["Feed", "/feed"],
    ["Messages", "/messages"],
    ["Producers", "/producers"],
    ["Studio", "/studio"],
    ["AI Assistant", "/ai"],
    ["Upload Reel", "/reels#reel-upload"],
  ];

  useEffect(() => {
    const onPlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; title?: string; playing?: boolean }>).detail;
      if (detail?.id && detail.title) setActivePlayback({ id: detail.id, title: detail.title, playing: Boolean(detail.playing) });
    };
    window.addEventListener("beatbox:playback", onPlayback);
    return () => window.removeEventListener("beatbox:playback", onPlayback);
  }, []);

  useEffect(() => { setActivePlayback(null); }, [location]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner container">
          <BrandLogo />
          <nav className="desktop-nav" aria-label="Primary navigation">
            {nav.map(([label, href]) => <Link key={href} href={href} className={location === href ? "is-active" : ""}>{label}</Link>)}
          </nav>
          <div className="site-header__actions"><button type="button" className={`lite-toggle ${liteMode ? "is-active" : ""}`} onClick={toggleLiteMode} aria-pressed={liteMode} title="Reduce video, image, and autoplay data use">{online ? "Online" : "Offline"} · {liteMode ? "Lite" : "Full"}</button>
            <Link href="/cart" className="icon-action" aria-label="Cart"><ShoppingBag size={19} /></Link>
            {user ? <>
              <Link href="/account?tab=notifications" className="icon-action notification-action" aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : "Notifications"}><Bell size={19} />{unreadNotifications > 0 && <span className="notification-badge" aria-hidden="true">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Link>
              <Link href={dashboardHref} className="account-pill"><UserRound size={15} /> <span>{profile?.display_name || "Account"}</span></Link>
              <button type="button" className="text-button desktop-only" onClick={() => void signOut()}>Sign out</button>
            </> : <Link href="/auth" className="button button--small">Sign in</Link>}
            <button type="button" className="mobile-menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menuOpen && <nav className="mobile-nav container" aria-label="Mobile navigation">
          {nav.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}
          <Link href="/messages" onClick={() => setMenuOpen(false)}><MessageCircle size={16} /> Messages</Link><Link href="/reels#reel-upload" onClick={() => setMenuOpen(false)}><Camera size={16} /> Upload Reel</Link><Link href="/favorites" onClick={() => setMenuOpen(false)}><Heart size={16} /> Favorites</Link><Link href="/saved" onClick={() => setMenuOpen(false)}><Bookmark size={16} /> Saved items</Link><Link href="/ai" onClick={() => setMenuOpen(false)}>AI Assistant</Link><Link href="/catalog" onClick={() => setMenuOpen(false)}>Creator catalog</Link><Link href="/help" onClick={() => setMenuOpen(false)}>How it works</Link>
          {user && <button type="button" onClick={() => void signOut()}>Sign out</button>}
        </nav>}
      </header>
      <main>{children}</main>
      {activePlayback && <div className="compact-player" role="status" aria-live="polite"><div className="compact-player__art"><CirclePlay size={18} /></div><div><small>{activePlayback.playing ? "Now playing" : "Ready to resume"}</small><b>{activePlayback.title}</b></div><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("beatbox:toggle-active-playback", { detail: { id: activePlayback.id } }))} aria-label={`${activePlayback.playing ? "Pause" : "Resume"} ${activePlayback.title}`}>{activePlayback.playing ? <CirclePause size={28} /> : <CirclePlay size={28} />}</button></div>}
      <nav className="mobile-bottom-nav" aria-label="Quick navigation"><Link href="/" className={location === "/" ? "is-active" : ""}><Compass size={17} /><span>Discover</span></Link><Link href="/charts" className={location === "/charts" ? "is-active" : ""}><BarChart3 size={17} /><span>Charts</span></Link><Link href="/search" className={location === "/search" ? "is-active" : ""}><Search size={17} /><span>Search</span></Link><Link href="/feed" className={location === "/feed" || location === "/community" ? "is-active" : ""}><Heart size={17} /><span>Feed</span></Link><Link href={user ? "/saved" : "/auth"} className={location === "/saved" ? "is-active" : ""} aria-label="Library"><Library size={17} /><span>Library</span></Link></nav>
      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div><BrandLogo compact /><p>Built for artists, producers, and music communities ready to move with more ownership.</p></div>
          <div><h2>Explore</h2><Link href="/explore">Browse beats</Link><Link href="/catalog">Creator catalog</Link><Link href="/feed">Feed</Link><Link href="/community">Community archive</Link><Link href="/saved">Saved items</Link><Link href="/producers">Producers</Link><Link href="/studio">Creator studio</Link><Link href="/ai">AI assistant</Link><Link href="/seller">Sell on BeatBox</Link></div>
          <div><h2>Support</h2><Link href="/help">Help center</Link><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
          <div className="site-footer__note"><h2>Secure by design</h2><p>Master files stay private. Downloads are issued only after verified entitlement and expire automatically.</p></div>
        </div>
        <div className="container site-footer__legal">© {new Date().getFullYear()} BeatBox. All rights reserved.</div>
      </footer>
    </div>
  );
}
