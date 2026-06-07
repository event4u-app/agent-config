---
status: ready
complexity: structural
---

# Road to video deferred design — checkpoint/resume, ComfyUI sandbox, provenance (design-gated backlog)

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-06, design mode):**
> these items are real but must NOT be built before a design artifact — the
> meta-warning was "don't build a skill suite as if it were a runtime
> framework". Checkpoint/resume needs rollback + state-schema + cleanup
> semantics first; ComfyUI executes arbitrary Python and is a hard no until
> sandboxed. Each item below therefore starts with the design artifact, not the
> implementation. Draft until the music-video orchestration roadmap ships.

## Goal

Hold the design-gated, lower-leverage video work in one place so it cannot be
pulled ahead of validation, and so each item ships its design rationale before
any code.

## Phase 1 — Checkpoint/resume (design first)

- [x] Write an ADR: state schema, rollback semantics, cleanup policy, and why a synchronous command suite needs persistent checkpoints (vs. idempotent commands with explicit save points). <!-- ADR-059 — council-converged (claude-sonnet-4-5 + gpt-4o, 2026-06-07, 2-round peer review): filesystem-as-state, NO checkpoint.json, no job reattachment, deletion-as-rollback, explicit --clean -->
- [x] Only after ADR sign-off: implement resume-from-last-green-artifact for the expensive render stages. <!-- lib/resume-scan.sh (scan|hash|clean) per ADR-059 + from-song/from-script wiring + tests/test_ai_video_resume_scan.py (9 passed) -->

## Phase 2 — ComfyUI local adapter (sandbox first)

- [x] Write an ADR on sandboxing arbitrary-Python workflow execution (process isolation, no host FS, pinned custom-node set) before any adapter code. <!-- ADR-060 — council-converged (claude-sonnet-4-5 + gpt-4o, 2026-06-07, 2-round peer review): container-primary (cap-drop ALL, network-none), SHA-pinned node allowlist hard-refuse, shipped templates only, remote escape hatch operator-owned -->
- [x] Only after sign-off: a ComfyUI multiplexer adapter (Wan2.2 TI2V-5B as the Apache-2.0 default template, LTX-2 for audio-sync) as the local-free path for GPU users. <!-- adapters/comfyui.sh per ADR-060 + nodes allowlist + 2 shipped templates + model-capabilities/comfyui.json + XML example block + contract local-source rule + tests/test_ai_video_comfyui_sandbox.py (117 passed across adapter suites) -->

## Phase 3 — Provenance + local lip-sync + ingest + telemetry

- [x] Implement the provenance embedding (C2PA / SynthID) the `transparency` policy already declares but does not yet enforce in code. <!-- lib/embed-provenance.sh: always-on sidecar + ffmpeg container tag + operator-installed c2patool path (no strip path by design); wired into from-song Step 9.4 + transparency.md enforcement note; tests/test_ai_video_provenance.py (10 passed) -->
- [x] Add a `MuseTalk`-class local lip-sync adapter (MIT) as the offline alternative to the hosted one. <!-- adapters/musetalk.sh (local-source rule, collapsed run, dry-run-safe) + model-capabilities/musetalk.json (same sparse lipsync_budget) + XML block + from-song wiring; contract suites 105 passed -->
- [x] Add song-link ingest (Suno / Udio / YouTube → local file) as a convenience input. <!-- lib/ingest-song.sh (yt-dlp wrapper: https-only, injection guard, size cap, rights note, no silent overwrite) + from-song URL input wiring; tests/test_ai_video_ingest_song.py (11 passed) -->
- [x] Add per-adapter telemetry (success / cost / latency) to inform later promotion decisions. <!-- lib/telemetry.sh (local-only JSONL under agents/runtime/state/, AIV_TELEMETRY=false kill-switch, summary CLI) wired into aiv_dispatch for submit/poll/fetch/run — dry-run/capability untouched (byte-exact fixtures); tests/test_ai_video_telemetry.py (7 passed) -->

## Acceptance criteria

- No item in this roadmap is implemented before its design artifact (ADR) is signed off.
- Checkpoint/resume and ComfyUI each have an ADR before any code lands.
