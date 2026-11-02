---
complexity: lightweight
status: later
entry_condition:
  what: the owner decides the cloud delivery batch (1.2, 2.1, 3.2, 3.3), blocker cloud-delivery-owner-decision; 0.3 needs one human run in a real claude.ai/code session
  when: on the owner's answer to the delivery question asked at the close of round inbox-2026-11-f
  who: owner (decision); then an implementer for 2.1 and its dependents
review_by: 2026-12-15
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-an-install-the-cloud-clone-carries
---
# Road to an install the cloud clone carries — carried

> **Source:** carried by the archival sweep on 2026-11-02 from
> [`road-to-an-install-the-cloud-clone-carries`](../archive/road-to-an-install-the-cloud-clone-carries.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-an-install-the-cloud-clone-carries deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-an-install-the-cloud-clone-carries

- [ ] **0.3 One real cloud session.** Run `/context` and `/hooks` in a
      claude.ai/code session on this repository and on a consumer fixture; confirm
      (b) Node `>=22.6.0` on the cloud PATH and (c) install time under the cache limit.
      Deferred: needs a human in a real cloud session; nothing in this tree can run it.
- [ ] **1.2 Committed SessionStart hook in consumer repos.** A hook that prints the
      same line inside the cloud session itself. Deferred: it writes into consumer
      repositories by default — a consumer-facing default change, owner decision
      bundled with 2.1.
- [ ] **2.1 Choose and build variant B** (`init --carry=repo`, opt-in: the hook
      matrix byte-identical in `.claude/settings.json`, a SessionStart bootstrap that
      installs the runtime from npm only when `CLAUDE_CODE_REMOTE=true`). Variant A
      (setup script) is closed by the host docs for hooks. Deferred: owner decision —
      new consumer-facing install mode and a hook-time network call.
      verify: the clone probe reports the three fail_closed guards active and a
      local run shows no double fire.
- [ ] **3.2 Stop writing `enabledPlugins` for the deprecated plugin** (D3).
      Deferred: changes what `init` writes into every consumer repo; owner decision,
      same batch as 2.1.
- [ ] **3.3 Commit a `.claude/settings.json` with hooks for this repository** (D6).
      Deferred: depends on the 2.1 choice.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-an-install-the-cloud-clone-carries |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-an-install-the-cloud-clone-carries` is still `[ ]` without a recorded disposition.
