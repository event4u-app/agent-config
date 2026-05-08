# iOS Simulator Guide

> Decision matrix and reference modules for driving the iOS Simulator
> from the command line — `simctl`, `idb`, accessibility-driven
> testing, and known troubleshooting paths.

## Scope and audience

- Reference material for any work touching the iOS Simulator on macOS
  hosts: smoke tests, accessibility audits, visual regressions, bug
  capture, multi-device test sweeps.
- Intended companions: `react-native-setup` skill (environment),
  `mobile-e2e-strategy` skill (framework selection), `playwright-testing`
  / `e2e-plan` skills (cross-platform E2E strategy).
- **macOS-only:** Xcode + simctl + (optional) idb require a macOS host.
  On Linux/Windows this guideline is reference-only — no implementation
  recipes are portable.

## When to consult this guideline

- Picking a simulator interaction surface (simctl vs idb vs xcodebuild).
- Auditing iOS UI accessibility for a release.
- Driving the simulator from CI for smoke or visual regression tests.
- Diagnosing a stuck simulator, missing target, or empty accessibility tree.

## Decision matrix — interaction surface

| Surface | Use when | Avoid when |
|---|---|---|
| `xcrun simctl` | Boot/install/launch/screenshot/log capture; default for everything CLI-driven | Need accessibility tree or precise UI coordinates |
| `idb` (Facebook iOS Debug Bridge) | Accessibility-tree dumps, coordinate taps/swipes/text input, point-level inspection | Plain boot/launch tasks (simctl is lighter) |
| `xcodebuild` / `xcodebuild test` | Compile, sign, and run XCTest / XCUITest suites; CI integration | Ad-hoc scripted interaction (slow, heavyweight) |
| Direct UI Automation (XCUITest) | Native iOS app E2E with full Apple toolchain support | Cross-platform E2E (use Detox / Appium / Maestro — see `mobile-e2e-strategy`) |

**Rule of thumb:** start with `simctl`; reach for `idb` only when you
need accessibility-tree introspection or coordinate-level UI control.

## Authoritative upstream

This guideline inlines five reference modules **verbatim** from the
upstream `conorluddy/ios-simulator-skill` repository. The 21 Python
helper scripts that ship with the upstream skill (~8500 LOC, macOS-
and Xcode-bound) are **not forked** — script references inside the
modules below resolve against the upstream tree, not this suite.

- Upstream repo: `https://github.com/conorluddy/ios-simulator-skill`
- Pinned SHA: `3acd0717a1b571b1d051559c01ff230d6da28a05`
- Last checked: 2026-05-08
- Refresh trigger: quarterly review or sooner if any link 404s in CI.

When you need an upstream Python helper (`accessibility_audit.py`,
`visual_diff.py`, `app_state_capture.py`, `test_recorder`) clone the
upstream repo at the pinned SHA, run the helper from there, do **not**
copy it into a consumer project.

---

## Module 1 — iOS Accessibility Checklist

_Verbatim from `references/accessibility_checklist.md` at the pinned SHA above._

### Critical Rules (Must Fix)

#### 1. Interactive elements need labels
**Check:** `accessibilityLabel != nil`
**Fix:** Add descriptive label

#### 2. Buttons need text
**Check:** `label || value != ""`
**Fix:** Set button title or accessibilityLabel

#### 3. Images need descriptions
**Check:** `isImage && accessibilityLabel`
**Fix:** Add alt text via accessibilityLabel

### Warnings (Should Fix)

#### 4. Complex controls need hints
**Check:** `accessibilityHint for custom controls`
**Fix:** Explain what happens on activation

#### 5. Grouped elements need containers
**Check:** `isAccessibilityElement on containers`
**Fix:** Group related elements

#### 6. Text fields need placeholders
**Check:** `placeholder || accessibilityLabel`
**Fix:** Add placeholder text

### Info (Nice to Have)

#### 7. Automation identifiers
**Check:** `accessibilityIdentifier != nil`
**Fix:** Add for UI testing

#### 8. Trait specification
**Check:** `accessibilityTraits set correctly`
**Fix:** Use .button, .link, .header appropriately

#### 9. Frame size adequate
**Check:** `frame.width >= 44 && frame.height >= 44`
**Fix:** Minimum touch target 44x44pt

### Quick Audit Command

```bash
python scripts/accessibility_audit.py
```

### iOS Code Fixes

```swift
// Label
button.accessibilityLabel = "Submit form"

// Hint
slider.accessibilityHint = "Adjusts volume"

// Identifier
view.accessibilityIdentifier = "login-button"

// Traits
label.accessibilityTraits = .header
```

---

## Module 2 — IDB Quick Reference

_Verbatim from `references/idb_quick.md` at the pinned SHA above._

### UI Automation Commands

#### ui describe-all
**Usage:** `idb ui describe-all --json --nested`
**Output:** Complete accessibility tree
**Key:** Foundation for accessibility auditing

#### ui tap
**Usage:** `idb ui tap <x> <y>`
**Output:** None (success) or error

#### ui swipe
**Usage:** `idb ui swipe <x1> <y1> <x2> <y2>`
**Output:** None (success) or error

#### ui text
**Usage:** `idb ui text "<text>"`
**Output:** None (success) or error

#### ui describe-point
**Usage:** `idb ui describe-point <x> <y> --json`
**Output:** Element at coordinates

### Other Essential Commands

#### list-targets
**Usage:** `idb list-targets`
**Output:** Available simulators with UDIDs

#### screenshot
**Usage:** `idb screenshot --udid <udid> output.png`
**Output:** PNG file saved

#### list-apps
**Usage:** `idb list-apps --udid <udid>`
**Output:** Installed apps with bundle IDs

### Common Patterns

```bash
# Get accessibility tree
idb ui describe-all --json --nested > tree.json

# Basic interaction
idb ui tap 200 400
idb ui text "username@example.com"
idb ui tap 200 500  # Submit button
```

### Troubleshooting
See Module 5 below.

---

## Module 3 — simctl Quick Reference

_Verbatim from `references/simctl_quick.md` at the pinned SHA above._

### Essential Commands Only

#### list devices
**Usage:** `xcrun simctl list devices`
**Output:** Device list with UDIDs and states
**Key:** Use `booted` as UDID for current device

#### boot
**Usage:** `xcrun simctl boot <device-udid>`
**Output:** None (success) or error

#### launch
**Usage:** `xcrun simctl launch booted <bundle-id>`
**Output:** PID of launched app

#### install
**Usage:** `xcrun simctl install booted <app-path>`
**Output:** None (success) or error

#### io screenshot
**Usage:** `xcrun simctl io booted screenshot <file.png>`
**Output:** PNG file saved
**Options:** `--type=png|jpeg` (default: png)

#### io recordVideo
**Usage:** `xcrun simctl io booted recordVideo <file.mp4>`
**Output:** Video file (Ctrl+C to stop)
**Options:** `--codec=h264|hevc` (default: hevc)

#### get_app_container
**Usage:** `xcrun simctl get_app_container booted <bundle-id> data`
**Output:** Path to app's data directory

#### spawn log
**Usage:** `xcrun simctl spawn booted log stream --predicate 'process == "<app>"'`
**Output:** Live log stream

### Common Patterns

```bash
# Get booted device UDID
xcrun simctl list devices | grep Booted

# Quick app test
xcrun simctl boot <udid>
xcrun simctl install booted app.app
xcrun simctl launch booted com.example.app
xcrun simctl io booted screenshot test.png
```

### Troubleshooting
See Module 5 below.

---

## Module 4 — Test Patterns

_Verbatim from `references/test_patterns.md` at the pinned SHA above._

### Smoke Test
```bash
xcrun simctl boot <udid>
xcrun simctl launch booted <bundle-id>
python scripts/accessibility_audit.py
xcrun simctl io booted screenshot smoke.png
```

### Visual Regression
```bash
# Baseline
xcrun simctl io booted screenshot baseline.png

# After changes
xcrun simctl io booted screenshot current.png
python scripts/visual_diff.py baseline.png current.png
```

### Full Accessibility Audit
```bash
# Each screen
for screen in home login settings; do
  # Navigate to screen (app-specific)
  python scripts/accessibility_audit.py --output $screen.json
done
```

### Bug Report Capture
```bash
python scripts/app_state_capture.py \
  --app-bundle-id com.example.app \
  --output bug-report/
```

### Multi-Device Test
```bash
for device in "iPhone 15" "iPad Pro"; do
  udid=$(xcrun simctl create test-$device "$device")
  xcrun simctl boot $udid
  xcrun simctl install $udid app.app
  xcrun simctl launch $udid com.example.app
  xcrun simctl io $udid screenshot $device.png
  xcrun simctl delete $udid
done
```

### Performance Baseline
```bash
# Capture initial state
xcrun simctl io booted screenshot perf-before.png
# Run performance test
xcrun simctl launch booted com.example.app
sleep 5
xcrun simctl io booted screenshot perf-after.png
python scripts/visual_diff.py perf-before.png perf-after.png
```

### Login Flow Test
```python
from scripts.test_recorder import TestRecorder

rec = TestRecorder("Login Test")
rec.step("Launch app")
# idb ui tap 200 400  # Login button
rec.step("Enter credentials")
# idb ui text "user@example.com"
rec.step("Submit")
# idb ui tap 200 500
rec.generate_report()
```

---

## Module 5 — Troubleshooting

_Verbatim from `references/troubleshooting.md` at the pinned SHA above._

### Problem → Solution Format

#### Simulator won't boot
**Fix:** `killall Simulator && xcrun simctl erase <udid>`

#### IDB not connecting
**Fix:** `idb kill && idb companion --boot-status-check`

#### App won't launch
**Fix:** `xcrun simctl terminate booted <bundle-id> && xcrun simctl launch booted <bundle-id>`

#### Screenshot fails
**Fix:** Ensure simulator booted: `xcrun simctl boot <udid>`

#### "No booted devices"
**Fix:** `open -a Simulator` or `xcrun simctl boot <udid>`

#### IDB "Target not found"
**Fix:** `idb list-targets` to verify UDID

#### Permission denied
**Fix:** `chmod +x scripts/*.sh`

#### Python module not found
**Fix:** `pip3 install pillow` (for visual_diff.py)

#### Accessibility tree empty
**Fix:** App must be in foreground: `xcrun simctl launch booted <bundle-id>`

#### Video recording hangs
**Fix:** Ctrl+C to stop recording, file saves on interrupt

#### Logs not showing
**Fix:** Use correct app name: `xcrun simctl spawn booted log stream --predicate 'process == "AppName"'`

#### Device storage full
**Fix:** `xcrun simctl erase <udid>` (warning: deletes all data)

### Quick Diagnostics

```bash
# Check simulator state
xcrun simctl list devices | grep Booted

# Verify IDB connection
idb list-targets

# Test basic interaction
xcrun simctl io booted screenshot test.png
```

## Source attribution

Modules 1–5 above are reproduced verbatim from
`conorluddy/ios-simulator-skill` (MIT License) at SHA
`3acd0717a1b571b1d051559c01ff230d6da28a05`. Header levels were
demoted by one to integrate with this guideline's outline; module
content (text, code, command examples) is unchanged.
