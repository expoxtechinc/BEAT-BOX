import { Download, ExternalLink, Smartphone, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSAL_KEY = "beatbox:pwa-install-dismissed";
const RATING_DISMISSAL_KEY = "beatbox:rating-prompt-dismissed";

function readDismissal(key: string) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function saveDismissal(key: string) {
  try {
    window.localStorage.setItem(key, "true");
  } catch {
    // Storage can be unavailable in privacy-focused browsers; the prompt remains usable.
  }
}

function isStandaloneDisplay() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function installGuidance() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "On iPhone or iPad, tap Share, then choose Add to Home Screen.";
  if (/android/.test(userAgent)) return "Use your browser menu and choose Install app or Add to Home screen.";
  return "Use your browser’s install option to add BeatBox to this device.";
}

export function PwaAdoptionBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const [status, setStatus] = useState("");
  const [guidance, setGuidance] = useState("Install BeatBox for a faster, app-style listening experience.");
  const playStoreUrl = (import.meta.env.VITE_PLAY_STORE_URL as string | undefined)?.trim() || "";

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setInstallDismissed(readDismissal(INSTALL_DISMISSAL_KEY));
    setRatingDismissed(readDismissal(RATING_DISMISSAL_KEY));
    setGuidance(installGuidance());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setStatus("BeatBox is installed and ready from your home screen.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismissInstall = () => {
    saveDismissal(INSTALL_DISMISSAL_KEY);
    setInstallDismissed(true);
  };

  const dismissRating = () => {
    saveDismissal(RATING_DISMISSAL_KEY);
    setRatingDismissed(true);
  };

  const requestInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setStatus(choice.outcome === "accepted" ? "BeatBox will finish installing shortly." : "Installation was not completed. You can install BeatBox whenever you are ready.");
    setDeferredPrompt(null);
  };

  const openRating = () => {
    if (!playStoreUrl) return;
    window.open(playStoreUrl, "_blank", "noopener,noreferrer");
    dismissRating();
  };

  if (installed && ratingDismissed) return null;

  return <div className="pwa-adoption" aria-label="BeatBox app installation and feedback options">
    {!installed && !installDismissed && <aside className="pwa-adoption__card pwa-adoption__card--install">
      <div className="pwa-adoption__icon"><Smartphone size={20} /></div>
      <div className="pwa-adoption__copy"><strong>Install BeatBox</strong><p>Keep the marketplace one tap away, with an app-style home-screen experience.</p></div>
      <div className="pwa-adoption__actions">
        {deferredPrompt ? <button type="button" className="button button--small pwa-adoption__install" onClick={() => void requestInstall()}><Download size={16} /> Install app</button> : <span className="pwa-adoption__guidance">{guidance}</span>}
        <button type="button" className="pwa-adoption__dismiss" onClick={dismissInstall} aria-label="Dismiss install suggestion"><X size={17} /></button>
      </div>
    </aside>}
    {!ratingDismissed && <aside className="pwa-adoption__card pwa-adoption__card--rating">
      <div className="pwa-adoption__icon"><Star size={20} /></div>
      <div className="pwa-adoption__copy"><strong>Enjoying BeatBox?</strong><p>Your honest feedback helps us improve the music community.</p></div>
      <div className="pwa-adoption__actions">
        {playStoreUrl ? <button type="button" className="button button--small button--outline pwa-adoption__rate" onClick={openRating}>Rate BeatBox <ExternalLink size={15} /></button> : <span className="pwa-adoption__guidance">Play Store reviews will be available after the official listing launches.</span>}
        <button type="button" className="pwa-adoption__dismiss" onClick={dismissRating} aria-label="Dismiss feedback suggestion"><X size={17} /></button>
      </div>
    </aside>}
    {status && <p className="pwa-adoption__status" role="status">{status}</p>}
  </div>;
}
