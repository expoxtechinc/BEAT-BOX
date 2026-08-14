# BeatBox Android Build Guidance

## Supported implementation baseline

BeatBox uses Capacitor **v8** as its Android wrapper. The current Capacitor installation guidance requires a `package.json`, a separate directory containing built web assets, and an `index.html` at that asset directory’s root. BeatBox already meets those conditions with Vite output at `dist/public`.

The Capacitor configuration will use the existing web bundle rather than a remote URL. This keeps the app available through the installed WebView shell while its existing Supabase, Vercel API, storage, media, and authentication calls continue to use their configured HTTPS services. No server-side credential is added to Android configuration or source control.

| Requirement | BeatBox implementation |
|---|---|
| Application name | `BeatBox` |
| Android application ID | `com.sastechinc.beatbox` |
| Web assets directory | `dist/public` |
| Minimum supported Android version | API 24 (Android 7), matching the current Capacitor Android support baseline |
| Network permissions | `INTERNET` and `ACCESS_NETWORK_STATE` |
| Release artifact | Unsigned release `.aab`; signing remains an owner-managed release step |

## Continuous integration artifacts

The GitHub Actions workflow will use the official artifact upload action to retain a debug APK and unsigned release AAB for each successful Android build. Artifact names are explicit so they can be downloaded from the workflow run’s **Artifacts** section.

## Local build commands

```bash
pnpm run android:sync
pnpm run android:debug
pnpm run android:aab
```

`android:debug` creates an installable development APK. `android:aab` creates an **unsigned** release bundle only; it cannot be uploaded to Google Play until the owner signs it with an owner-managed release keystore.

The repository workflow is [`.github/workflows/android-build.yml`](../.github/workflows/android-build.yml). It performs the same web build and Capacitor synchronization before emitting the following downloadable artifacts:

| Artifact | Expected file |
|---|---|
| `BeatBox-debug-apk` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| `BeatBox-unsigned-release-aab` | `android/app/build/outputs/bundle/release/app-release.aab` |

## Sources

1. [Capacitor: Installing Capacitor](https://capacitorjs.com/docs/getting-started)
2. [Capacitor: Android Documentation](https://capacitorjs.com/docs/android)
3. [Capacitor: Configuring Android](https://capacitorjs.com/docs/android/configuration)
4. [GitHub Docs: Store and share data with workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)
