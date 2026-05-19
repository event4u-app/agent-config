---
name: react-native-setup
description: "Use when setting up React Native or Expo dev environments — Xcode, Android Studio, CocoaPods, EAS, Metro, New Architecture — even when the user just says 'my RN build won't start'."
source: package
domain: devops
workspaces:
  - engineering
packs:
  - react
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# react-native-setup

## When to use

- Initial React Native 0.76+ / Expo SDK 52+ environment setup
- Installing or configuring Xcode, Android Studio, or their command-line tools
- Setting up iOS simulators or Android emulators for development
- Troubleshooting "Command not found", `ANDROID_HOME`, or SDK path errors
- Fixing CocoaPods install failures (Apple Silicon, FFI, Ruby mismatches)
- Clearing Metro / Watchman cache or diagnosing reload loops
- Configuring EAS Build, dev clients, or OTA updates
- Migrating to or troubleshooting the New Architecture (Fabric / Turbo Modules)

**Cross-links:** `mobile-e2e-strategy` (Detox / Appium / Maestro selection),
`docs/guidelines/agent-infra/ios-simulator-guide.md` (iOS simulator decision matrix).

## Assess current setup before changing anything

Before installing or upgrading anything, inspect what's already there — modifying a working toolchain blindly is the most common source of wasted hours.

1. **Read `package.json`** — RN version, Expo SDK, scripts, native dependencies.
2. **Check `ios/Podfile` and `ios/Podfile.lock`** — CocoaPods version, deployment target, RCT_NEW_ARCH_ENABLED flag.
3. **Check `android/build.gradle` and `android/gradle.properties`** — Gradle version, compile/target SDK, `newArchEnabled`, NDK version.
4. **Verify host tools** — `node --version`, `xcodebuild -version`, `sdkmanager --list_installed`, `pod --version`, `watchman --version`.
5. **Check for an existing `.nvmrc`, `.tool-versions`, or `Brewfile`** — honour the project's pinned versions over global ones.
6. **Read project README and CONTRIBUTING** — many RN repos document one-time setup quirks (Apple Silicon Rosetta, Hermes flags, EAS profile names).

## Procedure

1. **Identify the target stack** — RN CLI vs Expo, target SDK, supported OS, monorepo or single-package.
2. **Verify prerequisites** — Node, package manager, Watchman, platform SDKs (see matrix below).
3. **Configure platform tooling** — Xcode + CocoaPods (iOS) or Android Studio + SDK 34/35 (Android).
4. **Install project dependencies** — `npm`/`yarn`/`pnpm`/`bun install`, then `pod install` for iOS.
5. **Run a smoke build** — `npm run ios` / `npm run android` / `npx expo start`.
6. **Validate** — app launches, fast refresh works, Metro bundler runs without warnings.
7. **On failure** — apply the matching pattern from "Common setup issues" below.

## Prerequisites (2025 baseline)

**Node.js**
- Node 20.x minimum (Node 18 EOL April 2025); Node 22 LTS recommended.
- `node --version && npm --version`.
- npm, yarn, pnpm, bun all supported. Corepack for yarn:
  `corepack enable && corepack prepare yarn@stable --activate`.

**Xcode (macOS, iOS)**
- Xcode 16.1+ minimum (RN 0.83), Xcode 26+ for Liquid Glass.
- `xcode-select --install` then `sudo xcodebuild -license accept`.
- iOS 15.1+ deployment target; iOS 18+/26 for latest features.

**Android Studio**
- Ladybug or later (2024.2.1+).
- SDK Platform 35 (API 35), Build-Tools 35.0.0, Platform-Tools, Emulator.
- NDK 27.1.12297006 + CMake 3.22.1+ for native modules / Turbo Modules.
- `compileSdkVersion 35`, `targetSdkVersion 35`, `minSdkVersion 24`.
- `ANDROID_HOME` exported; edge-to-edge display ready (Android 15+).

**Watchman**
- macOS: `brew install watchman`.
- Required for fast refresh on large codebases. Reset: `watchman watch-del-all`.

## Platform setup

**iOS**
- CocoaPods 1.15+: `sudo gem install cocoapods`.
- New Architecture pods: `RCT_NEW_ARCH_ENABLED=1 pod install`.
- Provisioning profiles, certificates managed in Xcode or via EAS.
- Simulator management: `xcrun simctl list devices`. Liquid Glass requires iOS 26 simulator.

**Android**
- Gradle 8.10+ (bundled with Ladybug).
- AVD with API 35 image; verify edge-to-edge layout.
- New Architecture: `newArchEnabled=true` in `gradle.properties`.

**Metro bundler**
- Default port 8081. Cache reset: `npx react-native start --reset-cache`.
- Symlink support and custom resolvers needed for monorepos.

**EAS Build (Expo)**
- `npm install -g eas-cli` then `eas login`.
- `eas build:configure` to seed `eas.json`.
- Dev clients for custom native modules; EAS Update for OTA.

## Common setup issues

**"Command not found"**
- PATH for Node, Android SDK, Xcode tools missing in `~/.zshrc` or `~/.bash_profile`.
- Symlink drift with nvm / fnm — re-run `nvm use` after shell reload.

**SDK not found**
- `echo $ANDROID_HOME` empty → re-export.
- Re-run SDK Manager; reinstall NDK if native modules fail.

**Pod install failures**
- CocoaPods < 1.15 incompatible with New Architecture — upgrade.
- Apple Silicon FFI compile errors → use system Ruby or rbenv-managed Ruby.
- Stuck pods: `pod deintegrate && pod install`.

**Build failures**
- Clean iOS: `cd ios && rm -rf build Pods Podfile.lock && pod install && cd ..`.
- Clean Android: `cd android && ./gradlew clean && cd ..`.
- Clear Xcode derived data when stale build artefacts persist.

**New Architecture issues**
- Turbo Module not found → confirm codegen ran during build.
- Fabric component not rendering → verify native registration.
- Bridge incompatibility → use the interop layer.

## Quick verification

```bash
node --version          # 20+ (22 LTS preferred)
npm --version
xcodebuild -version     # 16.1+
pod --version           # 1.15+
adb --version
emulator -version
watchman version
eas --version           # Expo only
echo $ANDROID_HOME      # non-empty
```

## Quick commands

**Create / run RN CLI project**
```bash
npx @react-native-community/cli init MyProject
cd MyProject
cd ios && RCT_NEW_ARCH_ENABLED=1 pod install && cd ..
npm start                # Metro
npm run ios              # in a second terminal
npm run android          # in a third terminal
```

**Create / run Expo project**
```bash
npx create-expo-app@latest MyProject
cd MyProject
npx expo start
# Custom native code → dev client:
npx expo install expo-dev-client
eas build --profile development --platform ios
eas build --profile development --platform android
```

**Simulator / emulator**
```bash
xcrun simctl list devices
xcrun simctl boot "iPhone 16 Pro"
emulator -list-avds
emulator -avd Pixel_8_API_35
```

**Reset everything**
```bash
watchman watch-del-all
npx react-native start --reset-cache    # RN CLI
npx expo start --clear                  # Expo
```

## Pro tips

1. **Shell profile** — add SDK paths once, reload once:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   ```
2. **EAS minimum `eas.json`** — `development` (dev client + internal), `preview` (internal), `production` (defaults).
3. **Hermes** — RN ≥ 0.70 ships Hermes by default; verify with `global.HermesInternal !== undefined` at runtime.
4. **Health check** — a single shell function running the verification block above catches 80 % of "it doesn't build" reports.

## Version compatibility (2025)

| Component | Minimum | Recommended | Notes |
|---|---|---|---|
| Node.js | 20.x | 22 LTS | Node 18 EOL April 2025 |
| React Native | 0.76 | 0.83 | New Architecture default since 0.76 |
| React | 18.3 | 19.2 | `Activity`, `useEffectEvent` |
| Expo SDK | 52 | 54 | Native tabs, Liquid Glass |
| Xcode | 16.1 | 26 | iOS 26 required for Liquid Glass |
| Android SDK | 34 | 35 | Edge-to-edge support |
| CocoaPods | 1.14 | 1.15+ | New Architecture compatibility |
| Gradle | 8.6 | 8.10+ | K2 compiler support |

## Output format

1. A short setup plan keyed off the target stack (RN CLI vs Expo, iOS vs Android vs both).
2. Concrete shell commands the user can paste — no placeholders unless flagged `<…>`.
3. A verification block confirming the toolchain is healthy before any feature work.

## Auto-trigger keywords

- React Native, Expo, EAS Build
- Xcode, CocoaPods, pod install
- Android Studio, ANDROID_HOME, AVD, emulator
- Metro bundler, Watchman, fast refresh
- New Architecture, Fabric, Turbo Modules

## Gotcha

- Don't set `RCT_NEW_ARCH_ENABLED=1` selectively — once enabled, every `pod install` for that project must use it or cached artefacts diverge.
- Apple Silicon + system Ruby + FFI is the single biggest source of "pod install hangs" reports — switch to rbenv before retrying.
- Watchman left over from a previous project can pin Metro to a stale tree — `watchman watch-del-all` is cheap, run it before deeper debugging.
- iOS Simulator versions are tied to Xcode versions. Liquid Glass features need both Xcode 26 AND an iOS 26 simulator image installed.
- Android NDK version drift breaks Turbo Modules silently — pin `27.1.12297006` until the project explicitly upgrades.

## Do NOT

- Do NOT mix `npm`, `yarn`, `pnpm`, and `bun` lockfiles in the same project — pick one, commit its lockfile, delete the others.
- Do NOT skip `pod install` after pulling iOS-side changes — the JS bundle will load but native modules will be stale.
- Do NOT enable New Architecture mid-feature — flag it on a clean branch, run a full clean build, validate both platforms.
- Do NOT hand-edit `Podfile.lock` or `gradle.lock`-style files — re-run the installers instead.
- Do NOT commit `node_modules`, `ios/Pods`, `android/.gradle`, or platform `build/` directories.
