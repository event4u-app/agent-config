---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the F4-full stop-block continuation

> **Stub — not active work.** Transferred out of
> `road-to-always-on-orchestration.md` (blocker `f4-full-stop-block`, itself
> carried from the carriers roadmap) by the autonomous drain run of
> 2026-08-20. Council 2026-08-20 (anthropic/claude-sonnet-4-5 +
> openai/codex-default, quorum 2/2), disposition **B — transferred**, outcome
> state `transferred`. Rationale recorded by the council: *"The
> block/advisory decision depends on real-host delivery behavior and a
> telemetry distribution not present in the repository."*
>
> **Promotion note.** The three shared promotion criteria in
> [`README.md`](README.md) (recruited customer, funded security audit,
> maintainer ADR) **do not govern this stub.** This is a drain-run transfer of
> host-evidence work, not an org-mode surface behind a Hard Floor. Its gate is
> the re-entry probe below.

## 1. Original criterion (verbatim)

The transferred blocker's `Resolved when` clause, copied without edit:

> live delivery evidence exists and the block/advisory decision cites the
> telemetry distribution.

## 2. Dependent steps moved (complete list)

- **The live `additionalContext` probe** — the docs say `additionalContext` on
  Stop is delivered at exit 0, which would mean the *advisory* path already
  reaches the model. That is a documentation claim this repository has not
  observed, and the parent blocker's own instruction was "verify live first".
- **Session-marker (loop-guard) validation** — `stop_hook_active` is absent
  from current host docs, so any stop-block needs a self-built
  session-scoped marker. The end-review once-per-session state is the
  template. Validating that the marker actually prevents a re-block loop on a
  real host moves here.
- **Exact-line `review_skipped` calibration** — choosing the diff-size
  threshold at which a stop-block would fire, from the `exact` lines only
  (never mixing `exact` and estimated measures).
- **The block-versus-advisory decision itself** — whether the end-review
  obligation ships as a Stop-slot `decision: block` with reason, or stays the
  advisory line it is today.

Nothing about the current advisory carrier moves. `end_review_nudge_hook`
ships, emits one `review_skipped` telemetry line per qualifying Stop, and
never reports block severity — that is the shipped state and it stays.

## Probe — § 3, re-entry producer and detection

- **Named producer:** the **maintainer running the supported host** — the one
  host whose Stop slot both fires and honours a deny. Not "whoever hits the
  threshold"; the producer is the person who can capture a model-visible
  canary on that host.
- **Detection probe, two artefacts:**
  1. A **captured model-visible canary** — a string injected via
     `additionalContext` on Stop at exit 0 that provably reached the model.
     Delivery is the whole question: if the advisory path already reaches the
     model, the case for a block weakens substantially.
  2. A **dated telemetry report** over `review_skipped` lines with
     `mutation_measure: exact`, carrying the diff-size distribution the
     threshold is drawn from.
- **Probe value measured today (2026-08-20):** the telemetry half is **no
  longer empty**. `agents/runtime/state/audit/2026-08.jsonl` <!-- ref-ignore -->
  (gitignored runtime state) holds **9 `review_skipped` lines, all
  `mutation_measure: exact`**, with `diff_lines` at
  243 · 336 · 336 · 547 · 624 · 845 · 845 · 1602 · 1770.

**What 9 exact lines do and do not support.** They are a real distribution
where the parent roadmap recorded zero ("Telemetry accumulation is zero. F6/F4
shipped yesterday"), so the accumulation this blocker waits on has started and
is measurable. They do **not** support choosing a threshold: nine points
spanning 243 to 1770 have no usable shape, and every one of them is a session
where review was skipped — there is no contrast class in the file. The canary
half is untouched at zero. Recording the number is what lets the next reader
tell movement from noise rather than re-deriving both halves.

## Seed content on re-entry

- Probe delivery **before** designing the block. If `additionalContext` at exit
  0 reaches the model, the cheaper change is to strengthen the advisory line,
  and the block may never need to ship.
- The loop guard is session-scoped state the concern owns, written before the
  block is attempted, not after the first loop.
- Threshold from the `exact` distribution only. Mixing measures biases the
  number, and the concern's own doc already refuses the mix.
- A stop-block is block-capable on exactly one host today
  ([`hook-architecture-v1`](../../../docs/contracts/hook-architecture-v1.md)
  § Which hosts carry pre_tool_use is the sibling table for the pre-tool slot;
  read the Stop-slot row the same way). Whatever ships states its host scope
  honestly rather than implying universal enforcement.
