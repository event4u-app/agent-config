# Outcome Baseline

> Phase 1.1 deliverable for [`road-to-feedback-consolidation.md`](../roadmaps/road-to-feedback-consolidation.md).
> Locks in the four metrics the package commits to as proof of outcome.
> Each metric carries a definition, a measurement command, and a
> baseline placeholder that Phase 1.3–1.5 sessions populate.
> No metric is meaningful without a recorded session — a baseline of
> "TBD" is the **expected** state until those phases run.
>
> Last refreshed: 2026-05-04.

## Metric taxonomy

| # | Metric | Surface | Cadence | Lower is better? |
|---|---|---|---|---|
| (a) | Tool-call count per `/implement-ticket` run | work_engine log | per session | ✅ yes |
| (b) | Reply chars per task class | chat transcript | per turn | ✅ yes |
| (c) | Memory hit/miss ratio in `/work` runs | memory_retrieve trace | per session | ❌ higher hit ratio better |
| (d) | Verify-gate pass rate before first user re-prompt | verify-completion-evidence | per /implement-ticket session | ❌ higher better |

All four metrics are **proxies for outcome quality**. None of them
prove success on their own; together they triangulate whether the
package's rule-and-skill stack is moving the needle versus a baseline
agent. Phase 1.6 (`lint_showcase_sessions.py`) enforces that no
recorded session loses its metric block.

## (a) Tool-call count per `/implement-ticket` run

**Definition.** Total number of distinct tool invocations the agent
makes between the user's `/implement-ticket` prompt and the final
"complete" / "ready for review" reply, inclusive of the final reply
turn but excluding tool calls inside `/work` sub-orchestrations
launched from within the same ticket.

**Measurement command.** Runs against a captured session log:

```bash
python3 scripts/capture_showcase_session.py metrics \
  --session docs/showcase/sessions/<slug>.log \
  --metric tool-call-count
```

(Phase 1.2 deliverable. Until then, count `<tool_use ` blocks in the
captured log: `grep -c "<tool_use " docs/showcase/sessions/<slug>.log`.)

**Baseline (week of 2026-05-04).** TBD — populated by Phase 1.3 session.

**Limits.** Tool-call count is a coarse proxy. A high count can mean
either thorough verification or unfocused thrashing; pair with metric
(d) to disambiguate. Sessions that hit the council count each council
member call once.

## (b) Reply chars per task class

**Definition.** Mean character count (whitespace-stripped, excluding
fenced code blocks) of the agent's reply, bucketed by task class:
`/implement-ticket`, `/work`, `/review-changes`, free-form Q&A. The
goal is short replies; long replies are a failure mode per
[`direct-answers`](../../.agent-src.uncompressed/rules/direct-answers.md).

**Measurement command.**

```bash
python3 scripts/capture_showcase_session.py metrics \
  --session docs/showcase/sessions/<slug>.log \
  --metric reply-chars --bucket task-class
```

**Baseline (week of 2026-05-04).** TBD — populated by Phase 1.3–1.5
sessions, one bucket per session class.

**Limits.** Code blocks are excluded because they do not represent
prose verbosity. Numbered-options blocks count as prose (they are
the user-facing surface).

## (c) Memory hit/miss ratio in `/work` runs

**Definition.** For each `memory_retrieve_*` call inside a `/work`
session, record whether at least one entry was returned (`hit`) or
zero entries (`miss`). The ratio is `hits / (hits + misses)` over
the session.

**Measurement command.** Reads the visibility line emitted by
[`memory-visibility-v1`](../../docs/contracts/memory-visibility-v1.md)
(Phase 4.1 deliverable):

```bash
python3 scripts/capture_showcase_session.py metrics \
  --session docs/showcase/sessions/<slug>.log \
  --metric memory-hit-ratio
```

Until Phase 4 lands, count manually from the work_engine trace:
`grep -E "memory_retrieve.*hits=" docs/showcase/sessions/<slug>.log`.

**Baseline (week of 2026-05-04).** TBD — populated by Phase 1.4
session (`/work` free-form prompt).

**Limits.** A high hit ratio does not guarantee the hits were
**relevant**; it only proves memory is actively consulted. A near-zero
ratio in a mature project is the failure signal — it means the
project's memory store is empty or unreachable.

## (d) Verify-gate pass rate before first user re-prompt

**Definition.** For each `/implement-ticket` session, count how often
the verify-gate (`verify-completion-evidence` skill output) passed on
the first agent claim of "done", versus how often the user had to
re-prompt with a correction before the gate accepted the work. Pass
rate is `first-try-passes / total-claims`.

**Measurement command.**

```bash
python3 scripts/capture_showcase_session.py metrics \
  --session docs/showcase/sessions/<slug>.log \
  --metric verify-pass-rate
```

**Baseline (week of 2026-05-04).** TBD — populated by Phase 1.3
session (`/implement-ticket` end-to-end).

**Limits.** A user re-prompt that adds new scope (not a correction
of bad work) does not count against pass rate. The script
distinguishes "scope expansion" from "verification failure" by
matching the user's reply against a fixture of correction phrasings
(`"das passt nicht"`, `"that's wrong"`, `"missing X"`, etc.); ambiguous
re-prompts default to **not** counted, so pass rate is the optimistic
estimate.

## Refresh procedure

1. Phase 1.3 / 1.4 / 1.5 records a real session under
   `docs/showcase/sessions/<slug>.log`.
2. The capture script (Phase 1.2) writes a frontmatter block with
   commit SHA, host agent, model, timestamps, and the four metrics.
3. The "Baseline" line in each section above is replaced with the
   measured value plus the session slug.
4. Reviewer regenerates the dashboard so
   `agents/roadmaps-progress.md` reflects Phase 1 progress.

A baseline that is older than 30 days is **stale** and Phase 1.6's
linter flags it. The fix is to record a fresh session under the same
class, not to extend the staleness window.

## See also

- [`road-to-feedback-consolidation.md`](../roadmaps/road-to-feedback-consolidation.md) — owning roadmap (Phase 1)
- [`direct-answers`](../../.agent-src.uncompressed/rules/direct-answers.md) — brevity rule the (b) metric measures against
- [`verify-before-complete`](../../.agent-src.uncompressed/rules/verify-before-complete.md) — Iron Law the (d) metric measures
- `scripts/capture_showcase_session.py` — Phase 1.2 deliverable; computes the metrics
- `scripts/lint_showcase_sessions.py` — Phase 1.6 deliverable; CI gate
- [`memory-visibility-v1.md`](../../docs/contracts/memory-visibility-v1.md) — Phase 4.1 contract; provides the trace lines (c) reads
