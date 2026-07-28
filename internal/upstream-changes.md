# Upstream changes affecting reach channels

Append-only maintenance log. One entry per upstream platform or tool change
that broke (or silently degraded) a channel in `src/config/reach-channels.yml`.
This is a **document, not a service** — nothing polls it, nothing schedules
against it. It exists because a capability layer over volatile third-party
tools has a maintenance half-life, and the cheapest way to keep it honest is
to write down what broke and which registry edit fixed it.

Newest entry first. Keep entries short: date · symptom · registry edit.

## Format

```
### YYYY-MM-DD — <channel>: <one-line symptom>
- **Observed via:** reach:doctor / a failing task / an upstream release note
- **Symptom:** what the backend actually returned or failed to return
- **Registry edit:** the exact change in reach-channels.yml (backend reorder,
  version bump, lifecycle flip, removal_after set)
- **Verified by:** the command whose output proves the channel is healthy again
```

## Entries

### 2026-07-24 — bootstrap, no upstream breakage yet

- **Observed via:** the Phase 0 benchmark run (`internal/bench/reach-vs-native/`).
- **Symptom:** none upstream. Recorded so the log starts with a known-good
  baseline rather than an empty file: every channel's backend answered on first
  attempt except `youtube`, whose backend (`yt-dlp`) is **not installed** on the
  authoring machine — an absent-by-design state, not an upstream change.
- **Registry edit:** none. `last_verified: 2026-07-24` set on every channel at
  registry creation.
- **Verified by:** `./agent-config reach:doctor --format json`
