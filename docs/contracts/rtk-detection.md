---
stability: stable
---

# rtk Detection Contract — presence + identity, four states

> **Status:** active · **Version:** 1 · **Owner:** `road-to-rtk-onboarding-correctness`
> · **Primary implementation:** [`src/install/rtkDetection.ts`](../../src/install/rtkDetection.ts)
> · **Readouts:** `agent-config rtk:detect [--json]` · `GET /api/v1/wizard/detect-rtk` · `agent-config doctor-shell` (informational row)

Defines how agent-config decides whether **rtk (Rust Token Killer)** — a
**third-party Apache-2.0 tool**, upstream `https://github.com/rtk-ai/rtk` —
is installed, so that every consumer (the wizard, the `rtk_wrap` PreToolUse
hook, `agent-config doctor-shell`, and agent-switch's Tooling section) reads
ONE verdict from ONE implementation and cannot drift.

## § 1 — Why a boolean is wrong

Two unrelated projects share the binary name `rtk`: Rust Token Killer
(`rtk-ai/rtk`, the one agent-config integrates) and Rust Type Kit
(`reachingforthejack/rtk`, a codebase query tool — also what the bare
crates.io `rtk` crate resolves to). Upstream documents the collision in its
INSTALL.md. A filename-only PATH check therefore cannot answer "is rtk
installed"; it answers "is *something called* rtk installed", which shipped
a real false-positive bug (a Rust Type Kit user was told rtk was installed
and the wrap nudge activated for the wrong tool).

## § 2 — The two-stage probe

1. **Presence** — an executable named `rtk` (plus `.exe`/`.cmd`/`.bat` on
   Windows) resolvable on `PATH`.
2. **Identity** — run `rtk gain` with a short timeout and judge the
   **output signature, not the exit code** (upstream documents no exit-code
   contract for `rtk gain`, and `rtk --version` does not distinguish the two
   tools — both print `rtk <ver>`). The signature is the savings-dashboard
   header `RTK Token Savings` (captured live from rtk 0.43.0, 2026-07-28).

## § 3 — The four states (semantics locked)

| State | Shape | Meaning |
|---|---|---|
| absent | `{ present: false }` | Nothing named `rtk` on PATH. |
| verified | `{ present: true, identity: 'token-killer', version }` | Signature matched; `version` from `rtk --version`. |
| collision | `{ present: true, identity: 'unknown-rtk' }` | Probe ran; output clearly not Token Killer (e.g. unknown-subcommand error). |
| unverified | `{ present: true, identity: 'unverified' }` | Timeout, spawn failure, crash, or empty/ambiguous output — a broken *right* tool is not the wrong tool. |

Binding consumer rules:

- **"Installed" means `identity === 'token-killer'` — nothing else.** A
  colliding binary is NEVER reported as installed; `unverified` is NEVER
  silently treated as absent (each gets its own user-facing message).
- **`rtk_wrap` (and any behavior keyed on rtk) activates ONLY on
  `token-killer`.** `unverified` does not activate the wrap — fail closed
  for behavior, fail open for the user's command.
- **Install commands come from verified upstream paths only** and NEVER the
  bare `cargo install rtk` (wrong crate): darwin → `brew install rtk`;
  linux → upstream `install.sh` one-liner; win32 → two-tier
  (`winget install rtk-ai.rtk` + ripgrep note, documented-but-not-yet
  live-verified caveat; manual msvc-zip for winget-less images).

## § 4 — Machine-readable readout

`agent-config rtk:detect --json` emits:

```json
{
  "contract": 1,
  "installed": true,
  "present": true,
  "identity": "token-killer",
  "version": "0.43.0",
  "binPath": "/opt/homebrew/bin/rtk",
  "platform": "darwin",
  "repo": "https://github.com/rtk-ai/rtk",
  "installCommands": null
}
```

- `contract` bumps on any breaking shape change (field removal, semantics
  change); additive fields do not bump it.
- `installCommands` is non-null only when `present` is false — the per-OS
  tier object `{ recommended, recommendedLabel, manual?, manualLabel?, note? }`.
- `installed` is the derived boolean (`identity === 'token-killer'`) kept
  for consumers that need one bit — its semantics are locked to the
  verified state, never to presence.

## § 5 — Fallback probes must match

A consumer that probes on machines WITHOUT agent-config (agent-switch keeps
a documented fallback) MUST implement the same semantics: presence check +
`rtk gain` signature match on `RTK Token Savings` + the four states above.
This file defines those semantics so the two implementations cannot drift;
when upstream changes the dashboard header, THIS contract (and the primary
implementation's `TOKEN_KILLER_GAIN_SIGNATURE`) is the single place to fix.

## § 6 — Savings-claim hygiene (companion rule)

Any user-facing savings figure is **attributed to upstream** ("upstream
reports 60–90% — their estimate") unless agent-config has published its own
measurement. agent-config's scoped spot-measurement lives at
[`internal/bench/rtk-savings/RESULTS.md`](../../internal/bench/rtk-savings/RESULTS.md)
(2026-07-28: 33% overall on an 8-command corpus, 0–57% per command, **one repo
on one macOS machine**). That figure is **stale and not superseded**: the widened
re-bench is `road-to-terminal-token-economy` steps 3.2–3.4, deferred by AI council
on 2026-08-23 until Phase 2 chooses the wrapper mechanism. The label travels with
the number by design — a scope stated only at the canonical definition does not
survive being copied or summarised, which is how an unqualified "33 %" reaches a
reader in the first place.
