# AI-video adapter smoke traces

A **smoke trace** is the evidence that an adapter successfully completed a real
`submit → poll → fetch` round-trip against a live provider API — the gate
`provider-lifecycle-discipline` requires before an adapter is promoted
`experimental → stable`, and the prerequisite the
[video-foundation-validation roadmap](../../../roadmaps/road-to-video-foundation-validation.md)
Phase 2 is blocked on.

Traces are captured by the turnkey harness **`src/scripts/ai-video/smoke-trace.sh`**.

## Capture a trace

```bash
# DRY-RUN (default) — no network, no spend. Proves the harness + validates the
# v2 contract stdout shape + the trust boundary on the returned artifact path.
# A dry-run trace is PLUMBING PROOF, not a real validation.
bash src/scripts/ai-video/smoke-trace.sh --provider gemini-veo

# LIVE — the real round-trip. Hard Floor (non-destructive-by-default): needs a
# provider key in agents/.ai-video.xml and REAL SPEND. This is the maintainer's
# step. One command once the key is in place:
bash src/scripts/ai-video/smoke-trace.sh --provider <id> --live
```

Output lands here as `<provider>-<mode>-<utc>.json`. Commit the **live** trace
that clears the bar; dry-run traces are throwaway plumbing checks (don't commit).

## What the harness records

| Field | Meaning |
|---|---|
| `provider` / `lifecycle_tier` | adapter id + its `Lifecycle:` header tier |
| `mode` | `dry-run` (fixture, no spend) or `live` (real API, real spend) |
| `success` | all phases exit 0 **and** the returned artifact path passes the trust boundary |
| `phases[]` | `{name, ms, exit, stdout, stderr}` per `capability` / `dry-run` or `submit`/`poll`/`fetch` |
| `video_path` / `audio_embedded` / `cost_estimate` | the v2 `fetch` stdout shape |
| `artifact_path_validated` | the returned `video_path` resolved inside the project scope (`aiv_validate_artifact_path`) |

## Live-wiring status (what `--live` needs per adapter)

`--live` runs the adapter's real `submit/poll/fetch`. Today these are wired with
real HTTP: **`fal`, `replicate`, `higgsfield`** (the multiplexer / hosted set).
The stubs **`gemini-veo`, `sora`, `kling`** return `live not yet wired` (their
provider endpoints need per-key wiring first) — a `--live` run records that as an
honest failure, not a trace. So a first real trace is most reachable on a
live-wired adapter with a key.

## What this is NOT

A dry-run trace does **not** promote an adapter. Promotion `experimental → stable`
is a maintainer-authored tier flip gated on a **live** trace that clears the bar
(~10 renders, success rate + per-render cost vs the VGTeam baseline) — see the
roadmap Phase 2 and `provider-lifecycle-discipline`.
