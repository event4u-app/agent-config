---
status: draft
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

- [ ] Write an ADR: state schema, rollback semantics, cleanup policy, and why a synchronous command suite needs persistent checkpoints (vs. idempotent commands with explicit save points).
- [ ] Only after ADR sign-off: implement resume-from-last-green-artifact for the expensive render stages.

## Phase 2 — ComfyUI local adapter (sandbox first)

- [ ] Write an ADR on sandboxing arbitrary-Python workflow execution (process isolation, no host FS, pinned custom-node set) before any adapter code.
- [ ] Only after sign-off: a ComfyUI multiplexer adapter (Wan2.2 TI2V-5B as the Apache-2.0 default template, LTX-2 for audio-sync) as the local-free path for GPU users.

## Phase 3 — Provenance + local lip-sync + ingest + telemetry

- [ ] Implement the provenance embedding (C2PA / SynthID) the `transparency` policy already declares but does not yet enforce in code.
- [ ] Add a `MuseTalk`-class local lip-sync adapter (MIT) as the offline alternative to the hosted one.
- [ ] Add song-link ingest (Suno / Udio / YouTube → local file) as a convenience input.
- [ ] Add per-adapter telemetry (success / cost / latency) to inform later promotion decisions.

## Acceptance criteria

- No item in this roadmap is implemented before its design artifact (ADR) is signed off.
- Checkpoint/resume and ComfyUI each have an ADR before any code lands.
