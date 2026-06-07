---
adr: 059
status: accepted
date: 2026-06-07
decision: render-resume-filesystem-as-state
supersedes: —
superseded_by: —
phase: video deferred design (road-to-video-deferred-design, Phase 1)
type: structural
---

# ADR-059 — Resume-from-last-green-artifact: filesystem-as-state, no checkpoint file

## Status

**Accepted** · 2026-06-07. Design converged via two-round AI-council debate
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode + peer review,
2026-06-07). Both members independently converged on the same verdict in
round 2; no tie-break round needed. Implementation in the same roadmap phase
follows this design.

## Context

The `/video:from-song` and `/video:from-script` pipelines run expensive,
multi-scene paid renders. A mid-batch failure (rate-limit 429, content-policy
refusal, network drop, SIGINT) must not force re-paying for already-finished
scenes. The command prose already promised "re-running resumes from the
completed scenes (one project per invocation)" — but the state schema,
invalidation rule, rollback semantics, and cleanup policy were never designed.
A prior council round (2026-06-06) gated the implementation on exactly that
design, with the meta-warning: *"don't build a skill suite as if it were a
runtime framework."*

Options on the table: (a) filesystem-as-state — a scene is "green" iff its
directory holds a validated final artifact and no `error.json`; (b) a central
schema-versioned `<project>/checkpoint.json`; (c) per-scene sentinel files
plus a derived summary.

## Decision

**Filesystem-as-state with per-scene sentinels (option a refined by c). No
central `checkpoint.json`. No job reattachment. No rollback machinery. No
TTL cleanup.**

### 1. State schema — the scene directory IS the state

```
<project>/scenes/<id>/
  prompt.json     # the scene's render input (already exists) — hash source
  final.mp4       # existence + validation = the "green" marker
  error.json      # existence = failed (adapter error contract, already exists)
  cost.json       # {"charged_usd": …, "adapter": "…", "model": "…"} — spend record
```

- **No `done` sentinel** — a validated `final.mp4` (or the adapter-emitted
  clip name recorded in `prompt.json`) is the done marker.
- **No `job_id` sentinel** — job reattachment is out of scope (below).
- Any JSON the pipeline writes is written **atomically**: `jq … > tmp &&
  mv tmp target`. A crash mid-write can never half-corrupt state.
- All paths the resume scan consumes go through
  `aiv_validate_artifact_path` (trust boundary v2) — a hostile or corrupted
  scene dir cannot redirect the scan outside the project.

### 2. Resume validity — input-hash equality, single source of truth

A completed scene is **reusable** iff ALL of:

1. `scenes/<id>/final.mp4` exists and passes artifact validation;
2. no `scenes/<id>/error.json` is present;
3. the SHA-256 of the scene's **current** render input (canonicalized
   `prompt.json`: prompt blocks + ref-image content hashes + duration +
   aspect + seed + provider id + model id + adapter-contract version)
   equals the hash stored at render time (`prompt.json` carries
   `input_sha256`).

Anything else — prompt edited, script re-derived, provider/model switched,
contract version bumped, vocal map re-signed, file hand-tampered — fails the
hash equality and the scene re-renders. One rule covers the whole
invalidation surface instead of an enumerated (and forever-incomplete)
trigger list.

### 3. Rollback — deletion, not machinery

"Rollback" is the operator deleting state: `rm -rf <project>/scenes/3/` →
the next run re-renders scene 3. Full reset = delete the project dir. The
pipeline never auto-deletes a rendered artifact; partial spend stays visible
in the per-scene `cost.json` and is summed in the run report
(`spent so far: $X.YZ across N green scenes`).

### 4. Cleanup — explicit, never ambient

No TTL, no cron, no daemon (would violate the shell-first constraint). An
explicit `--clean` flag on the pipeline commands removes failed-scene
residue (`error.json`, partial downloads) before the run; the operator
deletes whole projects manually. Disk usage is surfaced in the report when a
project exceeds 2 GiB.

### 5. Job reattachment — rejected (negative ROI)

`poll`/`fetch` stay stateless per adapter-contract v2. An unfetched
submitted job is simply re-submitted on resume. The council's cost/benefit
analysis: the dominant failure modes (rate-limit, content-policy refusal)
leave nothing to reattach; accidental-SIGINT reattach is an edge case that
does not justify persisted job ids, their staleness window (providers purge
jobs), or the widened trust surface.

### 6. Kill-switch criteria — rated more important than resume

The batch loop enforces, per scene: **max 1 auto-retry** on a transient
failure (and only when `error.json` says `retryable: true` — and even then
the orchestrator surfaces the retry rather than looping silently); a
content-policy refusal halts the batch (never skip-and-continue past a
policy signal); the summed `cost.json` spend is checked against
`--max-spend-usd` before **every** live submit, not only at the upfront
gate.

### Meta-verdict (the question 5 answer)

A persistent checkpoint *file* is *not* justified. Idempotent commands +
filesystem-as-state + the existing one-batch-confirmation flow survive all
four stress scenarios (mid-batch crash, operator hand-edit of one scene,
provider/model switch between runs, script change between runs) with less
code, fewer trust-boundary entries, and no schema-versioning burden. This is
the "skill suite, not a runtime framework" answer.

## Consequences

- `from-song`/`from-script` Step "render scenes" gains a deterministic
  resume scan (`resume-scan.sh`) instead of prose; the scan emits
  per-scene `green | stale (hash mismatch) | failed | missing` and the
  reasons.
- `prompt.json` gains the `input_sha256` field at render time (additive).
- `cost.json` becomes the per-scene spend record consumed by the report and
  the mid-batch `--max-spend-usd` re-check.
- No migration: projects without `input_sha256` simply re-render (safe
  default — never reuse unverifiable state).

## Alternatives considered

- **Central `checkpoint.json` (option b)** — rejected: schema-versioning
  burden, non-atomic multi-scene writes, a second source of truth that can
  contradict the filesystem, wider trust surface (scene-id paths read from a
  file), and no capability the sentinel design lacks.
- **Enumerated invalidation triggers** — rejected: forever-incomplete
  (adapter bug fixes, provider-side deletions, hand-edits); replaced by
  input-hash equality.
- **TTL cleanup** — rejected: needs a daemon/cron or per-run timestamp
  sweeps; violates shell-first.
- **Job reattachment via stored job_id** — rejected for MVP (negative ROI,
  see § 5); revisit only with evidence of real SIGINT-resume demand.

## References

- Council artefact: two-round debate 2026-06-07 (members above), design
  mode, peer review on — convergence summarized in this ADR per
  `no-roadmap-references` (no session-file links).
- `src/scripts/ai-video/lib/adapter-contract.md` — v2 trust boundary +
  error contract this design builds on.
- Roadmap: road-to-video-deferred-design, Phase 1 (transient layer —
  not path-linked per `no-roadmap-references`).
- ADR-056 — adapter disposition context (validation-first strategy).
