import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sastechinc.beatbox",
  appName: "BeatBox",
  webDir: "dist/public",
  bundledWebRuntime: false,
  server: {
    // The native shell loads the already-public BeatBox release. No API or
    // service credentials are embedded in Android configuration or source.
    url: "https://sastechorg-beatbox.vercel.app",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [
      "sastechorg-beatbox.vercel.app",
      "sastechorg-beatbox-expoxtechincs-projects.vercel.app",
      "*.supabase.co",
    ],
  },
};

export default config;
