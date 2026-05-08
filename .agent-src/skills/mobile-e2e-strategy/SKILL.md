---
name: mobile-e2e-strategy
description: "Use when picking a mobile E2E framework — Detox / Appium / Maestro / XCUITest / Espresso — or planning iOS Simulator / Android Emulator coverage in CI for RN, Expo, or native apps."
source: package
---

# mobile-e2e-strategy

## When to use

- Choosing an E2E framework for a mobile app (React Native, Expo, Flutter, native iOS, native Android).
- Deciding whether to extend existing Playwright/web E2E to mobile or stand up a separate mobile suite.
- Planning iOS Simulator / Android Emulator coverage in CI (cost, runner type, parallelism).
- Triaging flaky mobile tests that span the simulator/emulator boundary.
- Bridging mobile E2E results into the same review surface as web E2E
  (`playwright-testing`, `e2e-plan`, `e2e-heal`).

**This skill selects and plans — it does not generate test code.** For the chosen framework, apply its own conventions; for the host environment, see the cross-links below.

## Cross-links

- `react-native-setup` — RN/Expo environment, Xcode/Android Studio, EAS Build.
- `docs/guidelines/agent-infra/ios-simulator-guide.md` — `simctl` / `idb` / accessibility-driven testing on iOS.
- `playwright-testing` — web E2E baseline (do **not** reuse for native mobile).
- `e2e-plan` — explore an app and produce an E2E plan in Markdown.
- `e2e-heal` — debug and fix failing E2E tests.

## Procedure

1. **Classify the app.** Is it native iOS, native Android, React Native, Expo, Flutter, or a web view inside a shell?
2. **Classify the goal.** Smoke (boots + login + key flow), regression (every release), visual diff, accessibility audit, or performance baseline.
3. **Pick the framework** using the decision matrix below.
4. **Confirm host availability.** macOS for iOS Simulator (mandatory); any OS for Android Emulator.
5. **Plan CI coverage.** Decide runner type, parallelism, and whether iOS coverage runs every PR or nightly only.
6. **Define the artefact contract.** Screenshots, accessibility trees, video, log archives — name the storage path and retention.
7. **Validate.** Run a single smoke test locally before wiring CI; verify both iOS and Android paths if both are in scope.

## Decision matrix — framework selection

| Framework | Best for | Avoid when |
|---|---|---|
| **Detox** | React Native apps, gray-box testing, deterministic sync with the JS bridge | Native iOS/Android-only; Expo managed without a dev client |
| **Maestro** | Cross-platform smoke + regression, declarative YAML flows, fast onboarding | Need full programmable assertions or deep native introspection |
| **Appium** | Truly cross-platform (RN + Flutter + native), one team owning many apps, WebDriver-compatible tooling | Solo project — setup overhead is high; flaky on JS-heavy RN unless tuned |
| **XCUITest** (iOS) | Native iOS apps, deepest Apple toolchain integration, Xcode Cloud | Cross-platform coverage in one suite |
| **Espresso** (Android) | Native Android apps, in-process execution, fast reliable runs | Cross-platform coverage in one suite |
| **Playwright + WebView** | Web app embedded in a thin native shell, purely web flows | Native UI flows of any depth (use a mobile framework instead) |

**Default starting point:**

- React Native / Expo → **Detox** (single-platform RN team) or **Maestro** (cross-platform smoke).
- Flutter → **Maestro** (smoke) + **Flutter integration_test** (deep) — Flutter-specific, out of scope here.
- Native iOS only → **XCUITest**.
- Native Android only → **Espresso**.
- Mixed native portfolio → **Appium**.

## Host & environment prerequisites

**iOS (macOS-only)**
- Xcode 16.1+ and matching Command Line Tools — see `react-native-setup`.
- iOS Simulator boot/install/launch via `simctl` — see `ios-simulator-guide.md`.
- Optional: `idb` for accessibility-tree access and coordinate-level UI control.
- Apple developer account only required for physical-device or signed-build runs.

**Android (any host)**
- Android Studio Ladybug+ with SDK 35, Platform-Tools, Emulator.
- AVD with API 35 image; verify `emulator -list-avds` and `adb devices`.
- HAXM/Hypervisor (Intel) or hardware acceleration on Apple Silicon.

**Authoritative upstream docs**
- iOS Simulator: `https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device`
- Android Emulator: `https://developer.android.com/studio/run/emulator`
- Detox: `https://wix.github.io/Detox/`
- Maestro: `https://maestro.mobile.dev/`
- Appium: `https://appium.io/docs/en/latest/`
- XCUITest: `https://developer.apple.com/documentation/xctest/user_interface_tests`
- Espresso: `https://developer.android.com/training/testing/espresso`

## CI floor — cost and capacity

| Concern | iOS | Android |
|---|---|---|
| Runner OS | macOS only (GitHub `macos-latest`, self-hosted Mac) | Any (Linux fastest) |
| Boot time | 30–90 s per simulator cold-boot | 60–180 s per emulator cold-boot |
| Parallelism | 1 simulator per macOS runner is the safe default | KVM-accelerated on Linux scales well |
| Cost (GitHub Actions) | macOS minutes are ~10× Linux minutes | Standard Linux pricing |
| Recommended cadence | Nightly + on-release for full suite; smoke on every PR | Every PR feasible |

**Pragmatic split:**

- Every PR: Android emulator full suite + iOS smoke only.
- Nightly / pre-release: iOS full suite + cross-device matrix.
- Adjust if the project pays for self-hosted Mac runners or the
  release cadence demands per-PR iOS parity.

## Artefact contract (recommended)

For every E2E run the suite SHOULD persist:

1. **Screenshots** — per-step PNG, named `{suite}/{test}/{step}.png`.
2. **Accessibility tree** — JSON dump per failure (iOS via `idb ui describe-all --json --nested`, Android via Espresso accessibility checks).
3. **Video** — full run on failure; first-class for Detox and Maestro.
4. **Logs** — structured logcat (Android) or `simctl spawn log` (iOS) filtered to the app under test.
5. **Result XML / JUnit** — for CI dashboard ingestion.

Retain artefacts for at least one release cycle; promote screenshots
of failures to the PR comment surface so reviewers see the failure
without leaving the review.

## Bridging to the existing E2E surface

- **Web + mobile in one repo:** keep Playwright for web, add a separate `mobile/` suite using Detox or Maestro. Do **not** force-fit Playwright onto native UI.
- **Plan reuse:** the planning patterns in `e2e-plan` (user journeys, test pyramid placement, stable selectors) apply unchanged. The implementation lives in the mobile framework.
- **Heal reuse:** the diagnostic loop in `e2e-heal` (reproduce → isolate → minimal fix → verify) applies. Replace browser-specific tooling with mobile-framework equivalents (Detox `--loglevel verbose`, Maestro Studio replays, Appium Inspector).
- **Selectors:** prefer accessibility identifiers (`accessibilityIdentifier` on iOS, `contentDescription` on Android) over coordinate taps — see `ios-simulator-guide.md` Module 1.

## Output format

1. A framework recommendation keyed off app type + team shape + cross-platform need.
2. A host & runner plan naming the macOS/Linux split for CI.
3. A cadence plan (per-PR vs nightly) with cost rationale.
4. An artefact contract listing screenshot/log/video/accessibility-tree paths.

## Auto-trigger keywords

- mobile E2E, React Native E2E, Expo E2E, Flutter E2E
- Detox, Appium, Maestro, XCUITest, Espresso
- iOS Simulator, Android Emulator, AVD, simctl, idb
- mobile CI, mobile test runner, macOS runner cost

## Gotcha

- Mobile E2E is fundamentally slower than web E2E — the test pyramid still applies; do not reach for E2E when a unit or integration test would do.
- iOS coverage on every PR is expensive on hosted runners; default to smoke on PR + full suite nightly until the cost is measured.
- React Native + Appium + non-trivial JS bridge timing is the historical flake hotspot — Detox or Maestro avoids the WebDriver layer entirely.
- Do not chain emulator-only tests from a developer laptop and a CI runner; environment drift (locale, timezone, API level) corrupts deterministic comparisons.
- Visual regression baselines are tied to a specific simulator/emulator image — pin the image SHA / API level explicitly in CI config.
- Maestro YAML is concise but not a full language; complex assertions still need Detox / Appium / native frameworks.

## Do NOT

- Do NOT reuse a Playwright suite for native UI flows — accessibility-tree access is wholly different.
- Do NOT mix two mobile E2E frameworks in one suite — pick one per platform pair, factor shared helpers behind a thin abstraction.
- Do NOT run iOS E2E on every PR until you measured the macOS-runner cost on the project's actual cadence.
- Do NOT rely on coordinate taps (`idb ui tap <x> <y>`) for stable tests — use accessibility identifiers instead. Coordinate taps are debug aids, not test selectors.
- Do NOT fork upstream simulator scripts (`accessibility_audit.py`, `visual_diff.py`, etc.) into the consumer project — link to the upstream SHA per `ios-simulator-guide.md`.
- Do NOT skip the artefact contract — without screenshots, logs, and accessibility trees, mobile E2E failures are nearly impossible to diagnose.
