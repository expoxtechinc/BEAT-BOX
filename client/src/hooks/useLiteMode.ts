import { useEffect, useState } from "react";

const STORAGE_KEY = "beatbox-lite-mode";

export function useLiteMode() {
  const [liteMode, setLiteMode] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    try {
      setLiteMode(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setLiteMode(false);
    }
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("lite-mode", liteMode);
  }, [liteMode]);

  const toggleLiteMode = () => {
    setLiteMode(current => {
      const next = !current;
      try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage is optional */ }
      return next;
    });
  };

  return { liteMode, online, toggleLiteMode };
}

export function applyLiteMode(root: HTMLElement | null, enabled: boolean) {
  root?.classList.toggle("lite-mode", enabled);
}
