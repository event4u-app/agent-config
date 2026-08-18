<!-- evidence-type: declared-skip -->

# Completion review — org-telemetry Phase 0 falsification spikes

**Skipped:** no code surface for this completion — the diff is three evidence findings plus the roadmap they close and its regenerated dashboard, and the gate itself measures zero code paths of five changed files, scope 0a809779433b098b8e23c71dfb8f405bcef6039b08c98ed2d5f02055b905df40, declared 2026-08-18

## Why a skip rather than a review

Phase 0 of `road-to-org-telemetry` is three falsification spikes whose own
rollback line reads "spikes are scratch-only; nothing ships". Nothing shipped:
the two measurement scripts stayed in the session scratchpad and are specified
in the findings rather than committed. What landed is
`agents/evidence/eval-findings/org-telemetry-s0{1,2,3}.md`,
`agents/roadmaps/road-to-org-telemetry.md`, and the regenerated
`agents/roadmaps-progress.md`. No script, hook, config, schema, or test.
`check_completion_review` classifies the diff as zero code paths of five changed
files, which is exactly the condition this declaration covers.

## What replaces a code review here

The findings are load-bearing numeric claims that decide a design branch, so each
was measured against live data rather than asserted, and each is reproducible
from the § Reproduction block of its own file.

- **The measurement instrument was validated against a different predicate than
  the one it measures.** s03's regex arm is a replica of `find_mentions` written
  for the scan; a replica that agrees with itself proves nothing. So the real
  `skill_usage_collect` was run over the same slug and emitted
  `exposure: 8908, mention: 1`, slug `agent-handoff` — and the replica returned
  1 record, 1 slug, the same slug. Agreement on the axis that carries the verdict.
- **Every number comes from session state or real transcripts, never a fixture.**
  The 22 `Skill` records are lines in
  `agents/runtime/state/tool-result-census.jsonl`, written by a concern bound on
  `post_tool_use`. The 164 invocations are `tool_use` blocks in 283 real session
  files. A fixture pass would not have proven the host sends any of it — the
  distinction this suite already paid for once.
- **The one inferential step is graded rather than hidden.** No artefact in the
  tree shows a Skill envelope's `tool_input` directly, because the census records
  `tool_name` and not `tool_input.skill`. s01 § "What is observed and what is one
  step removed" says so in those words, names the two legs the conclusion rests
  on, and names the one-line change that would close it — deliberately left to
  Phase 1.
- **The failing spike was not tuned into passing.** s02's blackhole case misses
  the 1000 ms bar by 2 ms, which a 950 ms timeout would "fix". The finding names
  that reading and rejects it, because the substance is the 2,500× coupling of
  session cost to sink health rather than the margin. The pre-registered fallback
  fires instead, which is what a falsification spike is for.
- **Stability was checked before the verdict was written.** s02 was run at n=50
  and n=100; every scenario verdict is identical across both runs, so the FAIL is
  not a boundary flap — the failure mode this repo has already recorded twice on
  a latency budget.
- **Both directions of the roadmap prerequisite were honoured.** All five Context
  claims were re-verified at `851568b5c`, including the two negative greps, and
  the settings-template grep was checked for scope before its emptiness was read
  as an answer — a gate that scans nothing exits green.

## What this completion deliberately does not do

- No Phase 1 or Phase 2 code, and no correction to Phase 2's step text: that step
  already defers to this spike ("per the second spike's result"), so there is no
  drift to repair.
- No resolution of `sink-choice` or `dpo-signoff`. Both are user-owned, and both
  say in their own `Blocks:` fields that Phase 0 runs without them.
- No repair of the collector-report path split s03 found. It is a real defect,
  recorded as a Phase 4 prerequisite, and fixing it here would be a code change
  inside a phase whose rollback forbids one.
