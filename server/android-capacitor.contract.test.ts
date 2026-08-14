import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("BeatBox Android Capacitor wrapper contract", () => {
  it("uses the production BeatBox release without embedding credentials", () => {
    const config = readProjectFile("capacitor.config.ts");

    expect(config).toContain('appId: "com.sastechinc.beatbox"');
    expect(config).toContain('appName: "BeatBox"');
    expect(config).toContain('webDir: "dist/public"');
    expect(config).toContain('url: "https://sastechorg-beatbox.vercel.app"');
    expect(config).not.toMatch(/SUPABASE_SERVICE|GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|VERCEL_TOKEN/i);
  });

  it("declares the native networking permissions and BeatBox app identity", () => {
    const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");
    const strings = readProjectFile("android/app/src/main/res/values/strings.xml");

    expect(manifest).toContain('android.permission.INTERNET');
    expect(manifest).toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(manifest).toContain('@drawable/beatbox_brand_icon');
    expect(strings).toContain('<string name="app_name">BeatBox</string>');
    expect(strings).toContain('<string name="package_name">com.sastechinc.beatbox</string>');
  });

  it("keeps native branding resources and current Android compatibility settings", () => {
    const styles = readProjectFile("android/app/src/main/res/values/styles.xml");
    const variables = readProjectFile("android/variables.gradle");
    const icon = readProjectFile("android/app/src/main/res/drawable/beatbox_brand_icon.xml");
    const splash = readProjectFile("android/app/src/main/res/drawable/beatbox_splash.xml");

    expect(styles).toContain('@drawable/beatbox_splash');
    expect(variables).toContain('minSdkVersion = 24');
    expect(icon).toContain('#D8AA47');
    expect(splash).toContain('#111217');
  });

  it("builds and archives a debug APK plus unsigned release AAB in GitHub Actions", () => {
    const workflow = readProjectFile(".github/workflows/android-build.yml");

    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm exec cap sync android");
    expect(workflow).toContain("assembleDebug bundleRelease");
    expect(workflow).toContain("BeatBox-debug-apk");
    expect(workflow).toContain("BeatBox-unsigned-release-aab");
    expect(workflow).toContain("app-release.aab");
    expect(workflow).not.toMatch(/secrets\.|keyAlias|storePassword|keyPassword/i);
  });
});
