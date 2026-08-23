---
complexity: lightweight
---

# Stub: the live arm for skill tiering (H1) — needs host sessions, not a repository

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated
> placeholder: the work is specified, wanted, and blocked only on a capability an
> autonomous repository run does not have. Transferred out of
> `agents/roadmaps/road-to-skill-delivery-over-mcp.md` by the autonomous drain run
> of 2026-08-23. The shared promotion criteria in
> [`README.md`](README.md) § Promotion criteria do **not** govern it; the probe
> below does.

## The criteria, verbatim

**4.2 Live arm (observed, small N, stated as such).**

> ≥ 20 sessions per arm on one machine, same repo, `skill-usage.jsonl` + MCP
> telemetry (`mcp_telemetry_query.ts`) as the only instruments. Report
> invocations, distinct skills, `suggest_skill_for_task` calls and their hit
> rate. No survivor count is inferred from host silence (the repo's standing
> rule).
> verify: the note states N per arm, the date range, the host version, and
> whether H1 held; a "did not hold" is a valid close.

**4.3 Measure R1 directly.**

> From the live arm, the fraction of sessions where a Tier B skill was *needed*
> (matrix says so) and the tool was *called* — by context position in the
> session. If adherence decays with context as the WG saw, the number is
> published and the `skill-route` push hook is confirmed as primary.
> verify: a table of `(session_context_tokens_bucket, tool_called_rate)` with
> ≥ 3 buckets, or an explicit statement that N was too small to bucket.

## Dependent steps moved here

Both of the above, and nothing else. Phase 4.1 (the deterministic arm) and 4.4
(the default decision) were **completed** in the parent roadmap — 4.4 against
its own pre-registered `measured-null` branch, precisely because these two could
not be run. Phases 0-3 and 5 are likewise unaffected.

## Why an autonomous run cannot do this

It needs **≥ 40 real interactive Claude Code sessions** — twenty under
`projection.mode: legacy-all`, twenty under `tiered` — on one machine, with a
human doing ordinary work in each so that skill selection is a real choice rather
than a scripted one. Three things follow that no repository automation supplies:

1. **A model's selection behaviour is the measurement.** H1 asks whether a model
   invokes the right skill more often; there is no file whose contents answer it.
   The deterministic arm exists precisely because everything computable was
   already computed
   (`agents/evidence/analysis/skill-tiering-matrix-arm.md`).
2. **The instruments are per-machine and currently empty.**
   `agents/runtime/metrics/skill-usage.jsonl` was last written 2026-05-16 and
   does not exist in a fresh checkout; it is populated by a collector reading
   `~/.claude/projects/<slug>/*.jsonl`, i.e. by sessions having happened.
3. **Switching arms is an install-level change.** Each arm requires a real
   install at a different `projection.mode`, so the two cannot be interleaved
   inside one session or simulated side by side.

Scripting forty headless prompts would measure a script, not a model, and would
produce a number in exactly the shape H1 wants while answering a different
question. That is the failure mode this stub exists to avoid.

## Named producer and detection probe

**Producer:** the maintainer, doing ordinary work on one machine across two
install configurations. Not a subsystem, not "when telemetry exists".

**Probe** — promote when this returns ≥ 20 for both arms:

```bash
# Sessions recorded per arm. Requires the collector to have run.
./scripts-run src/scripts/skill_usage_collect
wc -l < agents/runtime/metrics/skill-usage.jsonl
./scripts-run src/scripts/mcp_telemetry_query --help   # the second instrument
```

**Measured baseline on the transfer date (2026-08-23):**

- `agents/runtime/metrics/skill-usage.jsonl` — **absent**. Not zero rows: no file.
- `agents/evidence/analysis/skill-usage-report.md` — 337 skills tracked, **0
  active**, which is the same fact from the other side.
- Sessions available for either arm: **0**.

A later reader can therefore tell real movement from noise: any non-zero row
count is movement, and 20 per arm is the bar.

## Reasoning that would otherwise die with the parent

Three findings from the deterministic arm bear directly on how to read the live
one, and none of them is recoverable from the parent's checkbox:

- **81% of the labelled corpus (21 of 26 prompts) has its expected skill in Tier
  B.** So the live arm is not measuring a marginal change; `tiered` moves four
  fifths of that corpus from listed-but-bare to tool-only.
- **`tiered` costs MORE standing context than `legacy-all` on a default
  install** — 2,259 tok against 1,956 — because the host already caps delivery at
  roughly the Tier A set. The 82% saving exists only against a
  100%-delivery counterfactual. So the case for `tiered` rests **entirely** on
  H1; there is no context-saving fallback argument if H1 fails.
- **The prior is unfavourable and pre-registered as such.** The AAIF
  Skills-over-MCP working group measured models ignoring skills served over MCP
  and reaching for tools instead, with adherence declining as context grew. A
  live arm that finds H1 false is the expected outcome, not a surprise, and
  `docs/CLAIMS.md#claim-skill-tiering-h1-unmeasured` already records the null.

## Closing criterion — either direction counts

Closed when the live arm runs and H1 is reported in **either** direction, or when
a reader establishes that the question is moot — e.g. the host stops truncating
descriptions, at which point Tier B is empty and there is nothing to tier. A
measured "H1 did not hold" closes this stub as legitimately as a confirmation
does, and flips nothing: `tiered` is already opt-in.

## What must NOT be done to close it

Do not synthesise the arm from headless or scripted prompts, and do not infer a
survivor count from host silence. Both produce a number shaped like the answer to
a different question, and the parent roadmap's Phase 4.2 says so in its own text
("No survivor count is inferred from host silence").
